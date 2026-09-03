import { randomUUID, randomInt } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { getBookingById } from './bookingService';
import { getObligationsForBooking } from './paymentService';
import { sendNotification } from './notificationService';
import { assertStaffVerified } from './staffService';
import {
  ForbiddenActionError,
  InvalidCheckInCodeError,
  InvalidMatchStateError,
  MatchAlreadyExistsForBookingError,
  MatchInvitationNotFoundError,
  MatchNotCompletedError,
  MatchNotFoundError,
  PlayerProfileNotFoundError,
  ReplacementNotFoundError,
} from '../domain/errors';

interface MatchRow {
  match_id: string;
  booking_id: string;
  match_name: string | null;
  organizer_id: string;
  match_type: string;
  ball_type: string;
  overs_per_innings: number;
  scoring_mode: string;
  assigned_scorer_id: string | null;
  match_status: string;
  visibility: string;
  scheduled_start_time: Date;
  actual_start_time: Date | null;
  actual_end_time: Date | null;
  check_in_code: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MatchPlayerRow {
  match_player_id: string;
  match_id: string;
  player_id: string;
  match_team_id: string | null;
  participant_role: string;
  invitation_status: string;
  attendance_status: string;
  checked_in_at: Date | null;
  added_at: Date;
}

async function resolvePlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const [match] = await sequelize.query<MatchRow>(
    'SELECT * FROM matches WHERE match_id = :matchId',
    {
      type: QueryTypes.SELECT,
      replacements: { matchId },
    },
  );
  return match ?? null;
}

async function fetchMatchOrThrow(matchId: string): Promise<MatchRow> {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  return match;
}

// Notification fan-out (module 2.11) needs a player's user_id/bfam_id far
// more often than the rest of this file does raw player lookups — kept
// local rather than exported, since it's purely a notification-plumbing
// helper. Like sendNotification itself, never throws: a failure to resolve
// a notification recipient must never fail the real operation (invite,
// vacate, replacement) it's attached to.
async function resolvePlayerUserAndBfamId(
  playerId: string,
): Promise<{ user_id: string; bfam_id: string } | null> {
  try {
    const [row] = await sequelize.query<{ user_id: string; bfam_id: string }>(
      'SELECT user_id, bfam_id FROM players WHERE player_id = :playerId',
      { type: QueryTypes.SELECT, replacements: { playerId } },
    );
    return row ?? null;
  } catch (error) {
    console.error(`[matchService] Failed to resolve player ${playerId} for a notification:`, error);
    return null;
  }
}

async function fetchMatchPlayer(matchId: string, playerId: string): Promise<MatchPlayerRow | null> {
  const [row] = await sequelize.query<MatchPlayerRow>(
    'SELECT * FROM match_players WHERE match_id = :matchId AND player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { matchId, playerId } },
  );
  return row ?? null;
}

// Organizer, or the assigned scorer, can manage the match — a player who is
// merely a confirmed participant cannot invite/remove/manage others.
async function assertCanManageMatch(match: MatchRow, actorUserId: string) {
  if (match.organizer_id === actorUserId || match.assigned_scorer_id === actorUserId) return;
  throw new ForbiddenActionError('Only the match organizer or assigned scorer can do that.');
}

function generateCheckInCode(): string {
  // 6-digit numeric code — short enough to also show/type as a fallback if
  // the QR itself can't be scanned, per PRD §12.48.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export interface CreateMatchInput {
  booking_id: string;
  match_name?: string | null;
  match_type: string;
  ball_type: string;
  overs_per_innings: number;
  scoring_mode: string;
  assigned_scorer_id?: string | null;
}

// Create Game (PRD §12.9): links to a confirmed booking, sets format/ball
// type/scoring mode, optionally assigns a scorer. The organizer is added to
// the roster as CAPTAIN + CONFIRMED atomically with match creation. One
// match per booking (DB-enforced via uk_matches_booking_id).
export async function createMatch(userId: string, input: CreateMatchInput) {
  const booking = await getBookingById(input.booking_id, { userId, role: 'PLAYER' });
  if (booking.booked_by !== userId) {
    throw new ForbiddenActionError('Only the person who made this booking can create its match.');
  }
  if (booking.booking_status !== 'CONFIRMED') {
    throw new InvalidMatchStateError('A match can only be created for a confirmed booking.');
  }
  if (input.scoring_mode === 'TURF_STAFF_MANAGED' && !input.assigned_scorer_id) {
    throw new InvalidMatchStateError('Turf-staff-managed scoring requires an assigned scorer.');
  }

  const playerId = await resolvePlayerId(userId);
  const matchId = randomUUID();
  const now = new Date();
  const scheduledStartTime = new Date(`${booking.booking_date}T${booking.start_time}`);

  try {
    await sequelize.transaction(async (transaction) => {
      await sequelize.getQueryInterface().bulkInsert(
        'matches',
        [
          {
            match_id: matchId,
            booking_id: input.booking_id,
            match_name: input.match_name ?? null,
            organizer_id: userId,
            match_type: input.match_type,
            ball_type: input.ball_type,
            overs_per_innings: input.overs_per_innings,
            scoring_mode: input.scoring_mode,
            assigned_scorer_id: input.assigned_scorer_id ?? null,
            match_status: 'OPEN',
            visibility: 'PRIVATE',
            scheduled_start_time: scheduledStartTime,
            actual_start_time: null,
            actual_end_time: null,
            check_in_code: generateCheckInCode(),
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction },
      );

      // Two ad-hoc sides so a Friends Match doesn't force a registered Team
      // — player-to-side assignment happens later (Game Room roster), not
      // at creation time.
      await sequelize.getQueryInterface().bulkInsert(
        'match_teams',
        [
          {
            match_team_id: randomUUID(),
            match_id: matchId,
            team_id: null,
            side_label: 'TEAM_A',
            created_at: now,
          },
          {
            match_team_id: randomUUID(),
            match_id: matchId,
            team_id: null,
            side_label: 'TEAM_B',
            created_at: now,
          },
        ],
        { transaction },
      );

      await sequelize.getQueryInterface().bulkInsert(
        'match_players',
        [
          {
            match_player_id: randomUUID(),
            match_id: matchId,
            player_id: playerId,
            match_team_id: null,
            participant_role: 'CAPTAIN',
            invitation_status: 'CONFIRMED',
            attendance_status: 'PENDING',
            checked_in_at: null,
            added_at: now,
          },
        ],
        { transaction },
      );
    });
  } catch (error) {
    if (error instanceof Error && /uk_matches_booking_id/.test(error.message)) {
      throw new MatchAlreadyExistsForBookingError();
    }
    throw error;
  }

  return fetchMatchOrThrow(matchId);
}

// Matches tab: every match the caller organizes, is assigned to score, or
// is a roster participant on.
export async function listMyMatches(userId: string) {
  const playerId = await resolvePlayerId(userId).catch(() => null);
  return sequelize.query<MatchRow>(
    `SELECT DISTINCT m.* FROM matches m
     LEFT JOIN match_players mp ON mp.match_id = m.match_id AND mp.player_id = :playerId
     WHERE m.organizer_id = :userId OR m.assigned_scorer_id = :userId OR mp.player_id = :playerId
     ORDER BY m.scheduled_start_time DESC`,
    { type: QueryTypes.SELECT, replacements: { userId, playerId } },
  );
}

// Game Room (PRD §12.10): match info, roster with each player's
// confirmation/attendance, payment status (reusing module 2.4's
// obligations), and a rolled-up attendance summary.
export async function getGameRoom(matchId: string, _actorUserId: string) {
  const match = await fetchMatchOrThrow(matchId);

  const players = await sequelize.query<
    MatchPlayerRow & {
      bfam_id: string;
      favorite_cricketer_name: string | null;
      side_label: string | null;
    }
  >(
    `SELECT mp.*, p.bfam_id, p.favorite_cricketer_name, mt.side_label
     FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     LEFT JOIN match_teams mt ON mt.match_team_id = mp.match_team_id
     WHERE mp.match_id = :matchId
     ORDER BY mp.participant_role ASC, mp.added_at ASC`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );

  const obligations = await getObligationsForBooking(match.booking_id);
  const totalDue = obligations.reduce((sum, o) => sum + Number(o.amount_due), 0);
  const totalPaid = obligations
    .filter((o) => o.due_status === 'PAID')
    .reduce((sum, o) => sum + Number(o.amount_due), 0);

  const attendanceSummary = {
    confirmed: players.filter((p) => p.invitation_status === 'CONFIRMED').length,
    maybe: players.filter((p) => p.invitation_status === 'MAYBE').length,
    cant_play: players.filter((p) => p.invitation_status === 'CANT_PLAY').length,
    pending: players.filter((p) => ['PENDING', 'NO_RESPONSE'].includes(p.invitation_status)).length,
    checked_in: players.filter((p) => p.attendance_status === 'CHECKED_IN').length,
    running_late: players.filter((p) => p.attendance_status === 'RUNNING_LATE').length,
    no_show: players.filter((p) => p.attendance_status === 'NO_SHOW').length,
  };

  return {
    ...match,
    players,
    payment: {
      total_due: totalDue,
      total_paid: totalPaid,
      fully_paid: obligations.length > 0 && totalPaid >= totalDue,
    },
    attendance_summary: attendanceSummary,
  };
}

// Invite Players (PRD §12.11) — organizer/scorer-only. Creates both the
// audit-trail match_invitations row and an immediately-visible PENDING
// match_players row, so the invitee shows up in the Game Room roster right
// away rather than only after they respond.
export async function inviteToMatch(matchId: string, actorUserId: string, invitedPlayerId: string) {
  const match = await fetchMatchOrThrow(matchId);
  await assertCanManageMatch(match, actorUserId);

  const existing = await fetchMatchPlayer(matchId, invitedPlayerId);
  if (existing && !['CANT_PLAY', 'NO_RESPONSE'].includes(existing.invitation_status)) {
    throw new InvalidMatchStateError('This player is already on the match roster.');
  }

  const now = new Date();
  const invitationId = randomUUID();
  await sequelize.transaction(async (transaction) => {
    await sequelize.getQueryInterface().bulkInsert(
      'match_invitations',
      [
        {
          invitation_id: invitationId,
          match_id: matchId,
          invited_player_id: invitedPlayerId,
          invited_by: actorUserId,
          status: 'PENDING',
          sent_at: now,
          responded_at: null,
          expires_at: null,
        },
      ],
      { transaction },
    );

    if (existing) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'match_players',
          { invitation_status: 'PENDING', attendance_status: 'PENDING' },
          { match_player_id: existing.match_player_id },
          { transaction },
        );
    } else {
      await sequelize.getQueryInterface().bulkInsert(
        'match_players',
        [
          {
            match_player_id: randomUUID(),
            match_id: matchId,
            player_id: invitedPlayerId,
            match_team_id: null,
            participant_role: 'PLAYER',
            invitation_status: 'PENDING',
            attendance_status: 'PENDING',
            checked_in_at: null,
            added_at: now,
          },
        ],
        { transaction },
      );
    }
  });

  const invitedPlayer = await resolvePlayerUserAndBfamId(invitedPlayerId);
  if (invitedPlayer) {
    await sendNotification({
      userId: invitedPlayer.user_id,
      event: 'MATCH_INVITATION',
      params: { matchName: match.match_name ?? 'a match' },
      relatedEntityType: 'match',
      relatedEntityId: matchId,
    });
  }

  return { invitation_id: invitationId };
}

// Share-link invite (PRD §12.11): anyone holding the matchId (i.e. the
// link) can join directly as CONFIRMED, provided the match is still open.
// Simpler than a signed token for MVP — the match_id itself is the
// capability, same trust model as an unlisted share link generally has.
export async function joinMatchViaLink(matchId: string, userId: string) {
  const match = await fetchMatchOrThrow(matchId);
  if (match.match_status !== 'OPEN' && match.match_status !== 'PENDING') {
    throw new InvalidMatchStateError('This match is no longer accepting players.');
  }

  const playerId = await resolvePlayerId(userId);
  const existing = await fetchMatchPlayer(matchId, playerId);
  const now = new Date();

  if (existing) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'match_players',
        { invitation_status: 'CONFIRMED' },
        { match_player_id: existing.match_player_id },
      );
  } else {
    await sequelize.getQueryInterface().bulkInsert('match_players', [
      {
        match_player_id: randomUUID(),
        match_id: matchId,
        player_id: playerId,
        match_team_id: null,
        participant_role: 'PLAYER',
        invitation_status: 'CONFIRMED',
        attendance_status: 'PENDING',
        checked_in_at: null,
        added_at: now,
      },
    ]);
  }
}

// Player Confirmation flow (PRD §12.12): the invited player picks
// Confirmed / Maybe / Can't Play, which drives their line in the Game
// Room roster directly (module 2.6 doesn't need a separate polling step —
// the roster query reads match_players.invitation_status live).
export async function respondToMatchInvitation(
  invitationId: string,
  userId: string,
  response: 'CONFIRMED' | 'MAYBE' | 'CANT_PLAY',
) {
  const playerId = await resolvePlayerId(userId);
  const [invitation] = await sequelize.query<{
    invitation_id: string;
    match_id: string;
    invited_player_id: string;
    status: string;
  }>('SELECT * FROM match_invitations WHERE invitation_id = :invitationId', {
    type: QueryTypes.SELECT,
    replacements: { invitationId },
  });
  if (!invitation) throw new MatchInvitationNotFoundError(invitationId);
  if (invitation.invited_player_id !== playerId) {
    throw new ForbiddenActionError('This invitation is not addressed to you.');
  }

  const now = new Date();
  const invitationOutcome = response === 'CANT_PLAY' ? 'REJECTED' : 'ACCEPTED';

  // If this invitation happens to be for a replacement vacancy this player
  // was specifically picked to fill, confirming here resolves that vacancy
  // too — in the same transaction, so it's never possible to be CONFIRMED
  // on the roster while the vacancy still shows OPEN. This means the
  // mobile UI needs no special "accept replacement" flow: a replacement
  // invite is answered exactly like any other invite.
  const [openReplacement] = await sequelize.query<{ replacement_id: string }>(
    `SELECT replacement_id FROM player_replacements
     WHERE match_id = :matchId AND replacement_player_id = :playerId AND status = 'OPEN'`,
    { type: QueryTypes.SELECT, replacements: { matchId: invitation.match_id, playerId } },
  );

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'match_invitations',
        { status: invitationOutcome, responded_at: now },
        { invitation_id: invitationId },
        { transaction },
      );
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'match_players',
        { invitation_status: response },
        { match_id: invitation.match_id, player_id: playerId },
        { transaction },
      );
    if (response === 'CONFIRMED' && openReplacement) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'player_replacements',
          { status: 'FILLED', resolved_at: now },
          { replacement_id: openReplacement.replacement_id },
          { transaction },
        );
    }
  });

  if (response === 'CONFIRMED') {
    const match = await fetchMatch(invitation.match_id);
    const player = await resolvePlayerUserAndBfamId(playerId);
    if (match && player) {
      await sendNotification({
        userId: match.organizer_id,
        event: 'PLAYER_CONFIRMATION',
        params: { playerBfamId: player.bfam_id, matchName: match.match_name ?? 'your match' },
        relatedEntityType: 'match',
        relatedEntityId: invitation.match_id,
      });
    }
  }

  return { invitation_id: invitationId, response };
}

// Mobile convenience wrapper: the Game Room screen only knows the matchId
// (not the invitation_id), so it looks up the caller's own latest PENDING
// invitation for this match and responds to that — same underlying atomic
// respondToMatchInvitation.
export async function respondToMatchInvitationByMatch(
  matchId: string,
  userId: string,
  response: 'CONFIRMED' | 'MAYBE' | 'CANT_PLAY',
) {
  const playerId = await resolvePlayerId(userId);
  const [invitation] = await sequelize.query<{ invitation_id: string }>(
    `SELECT invitation_id FROM match_invitations
     WHERE match_id = :matchId AND invited_player_id = :playerId AND status = 'PENDING'
     ORDER BY sent_at DESC LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { matchId, playerId } },
  );
  if (!invitation) {
    throw new InvalidMatchStateError('You have no pending invitation for this match.');
  }
  return respondToMatchInvitation(invitation.invitation_id, userId, response);
}

// Attendance & Running-Late (PRD §12.14). A player may only update their
// own attendance, and only to RUNNING_LATE or CHECKED_IN — organizer/scorer
// use setPlayerAttendance for the full range (incl. NO_SHOW).
export async function updateMyAttendance(
  matchId: string,
  userId: string,
  status: 'RUNNING_LATE' | 'CHECKED_IN',
) {
  const playerId = await resolvePlayerId(userId);
  const membership = await fetchMatchPlayer(matchId, playerId);
  if (!membership) throw new InvalidMatchStateError('You are not on this match roster.');

  await sequelize.getQueryInterface().bulkUpdate(
    'match_players',
    {
      attendance_status: status,
      ...(status === 'CHECKED_IN' ? { checked_in_at: new Date() } : {}),
    },
    { match_player_id: membership.match_player_id },
  );
}

export async function setPlayerAttendance(
  matchId: string,
  actorUserId: string,
  targetPlayerId: string,
  status: 'PENDING' | 'RUNNING_LATE' | 'CHECKED_IN' | 'NO_SHOW',
) {
  const match = await fetchMatchOrThrow(matchId);
  await assertCanManageMatch(match, actorUserId);

  // Staff verification gate (module 2.12, PRD §32.14) — Check-In is one of
  // the two actions explicitly blocked until an owner approves the staff
  // member's document. Only applies when the actor is actually staff; the
  // organizer (a PLAYER) is unaffected.
  const [actor] = await sequelize.query<{ role: string }>(
    'SELECT role FROM users WHERE user_id = :actorUserId',
    { type: QueryTypes.SELECT, replacements: { actorUserId } },
  );
  if (actor?.role === 'TURF_STAFF') {
    await assertStaffVerified(actorUserId);
  }

  const membership = await fetchMatchPlayer(matchId, targetPlayerId);
  if (!membership) throw new InvalidMatchStateError('This player is not on the match roster.');

  await sequelize.getQueryInterface().bulkUpdate(
    'match_players',
    {
      attendance_status: status,
      ...(status === 'CHECKED_IN' ? { checked_in_at: new Date() } : {}),
    },
    { match_player_id: membership.match_player_id },
  );
}

// QR-based Check-In (PRD §12.48). The organizer/scorer displays
// getCheckInCode's value as a QR; each player scans it and self-check-ins.
export async function getCheckInCode(matchId: string, actorUserId: string) {
  const match = await fetchMatchOrThrow(matchId);
  await assertCanManageMatch(match, actorUserId);
  return { check_in_code: match.check_in_code };
}

export async function checkInWithCode(matchId: string, userId: string, code: string) {
  const match = await fetchMatchOrThrow(matchId);
  if (!match.check_in_code || match.check_in_code !== code) {
    throw new InvalidCheckInCodeError();
  }

  const playerId = await resolvePlayerId(userId);
  const membership = await fetchMatchPlayer(matchId, playerId);
  if (!membership) throw new InvalidMatchStateError('You are not on this match roster.');

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'match_players',
      { attendance_status: 'CHECKED_IN', checked_in_at: new Date() },
      { match_player_id: membership.match_player_id },
    );
}

// Player Replacement, step 1 — vacancy (PRD §12.15). The vacating player
// (or the organizer, on their behalf) opens a replacement search; the
// vacater's roster row moves to CANT_PLAY so the roster reflects reality
// immediately, independent of whether a replacement is ever found.
export async function vacateSpot(matchId: string, actorUserId: string, vacatingPlayerId: string) {
  const match = await fetchMatchOrThrow(matchId);
  const actorPlayerId = await resolvePlayerId(actorUserId).catch(() => null);
  const isSelf = actorPlayerId === vacatingPlayerId;
  if (!isSelf) await assertCanManageMatch(match, actorUserId);

  const membership = await fetchMatchPlayer(matchId, vacatingPlayerId);
  if (!membership || membership.invitation_status !== 'CONFIRMED') {
    throw new InvalidMatchStateError(
      'Only a confirmed player can be marked as vacating their spot.',
    );
  }

  const replacementId = randomUUID();
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'match_players',
        { invitation_status: 'CANT_PLAY' },
        { match_player_id: membership.match_player_id },
        { transaction },
      );
    await sequelize.getQueryInterface().bulkInsert(
      'player_replacements',
      [
        {
          replacement_id: replacementId,
          match_id: matchId,
          vacating_player_id: vacatingPlayerId,
          replacement_player_id: null,
          initiated_by: actorUserId,
          status: 'OPEN',
          created_at: now,
          resolved_at: null,
        },
      ],
      { transaction },
    );
  });

  const vacatingPlayer = await resolvePlayerUserAndBfamId(vacatingPlayerId);
  if (vacatingPlayer && vacatingPlayer.user_id !== match.organizer_id) {
    await sendNotification({
      userId: match.organizer_id,
      event: 'PLAYER_CANCELLATION',
      params: { playerBfamId: vacatingPlayer.bfam_id, matchName: match.match_name ?? 'your match' },
      relatedEntityType: 'match',
      relatedEntityId: matchId,
    });
  }

  return { replacement_id: replacementId };
}

// Player Replacement, step 2 — suggestions. Pragmatic MVP heuristic:
// players from the organizer's own teams who aren't already on this
// match's roster, rather than a full recommendation engine.
export async function suggestReplacements(replacementId: string, actorUserId: string) {
  const replacement = await fetchReplacementOrThrow(replacementId);
  const match = await fetchMatchOrThrow(replacement.match_id);
  await assertCanManageMatch(match, actorUserId);

  return sequelize.query<{ player_id: string; bfam_id: string; team_name: string }>(
    `SELECT DISTINCT p.player_id, p.bfam_id, t.team_name
     FROM team_members tm
     JOIN teams t ON t.team_id = tm.team_id
     JOIN players p ON p.player_id = tm.player_id
     WHERE t.created_by = :organizerId
       AND tm.membership_status = 'ACTIVE'
       AND p.player_id NOT IN (
         SELECT player_id FROM match_players
         WHERE match_id = :matchId AND invitation_status NOT IN ('CANT_PLAY', 'NO_RESPONSE')
       )
     LIMIT 20`,
    {
      type: QueryTypes.SELECT,
      replacements: { organizerId: match.organizer_id, matchId: match.match_id },
    },
  );
}

interface ReplacementRow {
  replacement_id: string;
  match_id: string;
  vacating_player_id: string;
  replacement_player_id: string | null;
  initiated_by: string;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}

async function fetchReplacementOrThrow(replacementId: string): Promise<ReplacementRow> {
  const [row] = await sequelize.query<ReplacementRow>(
    'SELECT * FROM player_replacements WHERE replacement_id = :replacementId',
    { type: QueryTypes.SELECT, replacements: { replacementId } },
  );
  if (!row) throw new ReplacementNotFoundError(replacementId);
  return row;
}

// Player Replacement, step 3 — invite a specific candidate to fill the
// vacancy (records the pick on the replacement row and sends a normal
// match invitation so the candidate sees it in their own invites list).
export async function inviteReplacement(
  replacementId: string,
  actorUserId: string,
  candidatePlayerId: string,
) {
  const replacement = await fetchReplacementOrThrow(replacementId);
  if (replacement.status !== 'OPEN') {
    throw new InvalidMatchStateError('This replacement vacancy has already been resolved.');
  }
  const match = await fetchMatchOrThrow(replacement.match_id);
  await assertCanManageMatch(match, actorUserId);

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'player_replacements',
      { replacement_player_id: candidatePlayerId },
      { replacement_id: replacementId },
    );
  await inviteToMatch(replacement.match_id, actorUserId, candidatePlayerId);

  const candidate = await resolvePlayerUserAndBfamId(candidatePlayerId);
  if (candidate) {
    await sendNotification({
      userId: candidate.user_id,
      event: 'REPLACEMENT_REQUEST',
      params: { matchName: match.match_name ?? 'a match' },
      relatedEntityType: 'match',
      relatedEntityId: match.match_id,
    });
  }
}

// Player Replacement, step 4 — the candidate accepts, atomically filling
// the vacancy: the replacement row moves OPEN → FILLED and the candidate's
// own match_players row moves to CONFIRMED, in one transaction so there's
// never a window where the vacancy shows FILLED without the player
// actually being confirmed (mirrors module 2.5's captain-change atomicity
// pattern).
export async function acceptReplacement(replacementId: string, userId: string) {
  const replacement = await fetchReplacementOrThrow(replacementId);
  if (replacement.status !== 'OPEN') {
    throw new InvalidMatchStateError('This replacement vacancy has already been resolved.');
  }
  const playerId = await resolvePlayerId(userId);
  if (replacement.replacement_player_id !== playerId) {
    throw new ForbiddenActionError('You were not invited to fill this vacancy.');
  }

  const membership = await fetchMatchPlayer(replacement.match_id, playerId);
  if (!membership) {
    throw new InvalidMatchStateError('Accept the match invitation first.');
  }

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'player_replacements',
        { status: 'FILLED', resolved_at: new Date() },
        { replacement_id: replacementId },
        { transaction },
      );
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'match_players',
        { invitation_status: 'CONFIRMED' },
        { match_player_id: membership.match_player_id },
        { transaction },
      );
  });

  const match = await fetchMatchOrThrow(replacement.match_id);
  const acceptedPlayer = await resolvePlayerUserAndBfamId(playerId);
  const vacatingPlayer = await resolvePlayerUserAndBfamId(replacement.vacating_player_id);
  if (acceptedPlayer) {
    const recipients = new Set([match.organizer_id]);
    if (vacatingPlayer) recipients.add(vacatingPlayer.user_id);
    for (const recipientUserId of recipients) {
      await sendNotification({
        userId: recipientUserId,
        event: 'REPLACEMENT_ACCEPTED',
        params: {
          playerBfamId: acceptedPlayer.bfam_id,
          matchName: match.match_name ?? 'the match',
        },
        relatedEntityType: 'match',
        relatedEntityId: replacement.match_id,
      });
    }
  }
}

export interface RebookInfo {
  turf_id: string;
  turf_name: string;
  preferred_start_time: string;
  duration_minutes: number;
  match_name: string | null;
  match_type: string;
  ball_type: string;
  overs_per_innings: number;
  scoring_mode: string;
  roster: { player_id: string; bfam_id: string }[];
}

// Rebook Same Players (PRD §12.44): from a completed match, the organizer
// gets everything Create Game (module 2.6) needs to start again with the
// same turf, format, and roster — same players, same team, same turf, same
// preferred time, same match format. The actual new booking/slot pick and
// match creation still go through the normal 2.3/2.6 flows (this is a
// prefill, not an auto-rebooking that would skip slot availability or
// payment); the mobile client re-invites the returned roster after the new
// match is created.
export async function getRebookInfo(matchId: string, actorUserId: string): Promise<RebookInfo> {
  const match = await fetchMatchOrThrow(matchId);
  if (match.organizer_id !== actorUserId) {
    throw new ForbiddenActionError('Only the match organizer can rebook this match.');
  }
  if (match.match_status !== 'COMPLETED') {
    throw new MatchNotCompletedError();
  }

  const [booking] = await sequelize.query<{
    turf_id: string;
    turf_name: string;
    start_time: string;
    duration_minutes: number;
  }>(
    `SELECT b.turf_id, t.turf_name, b.start_time, b.duration_minutes
     FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
     WHERE b.booking_id = :bookingId`,
    { type: QueryTypes.SELECT, replacements: { bookingId: match.booking_id } },
  );

  const roster = await sequelize.query<{ player_id: string; bfam_id: string }>(
    `SELECT mp.player_id, p.bfam_id FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED'`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );

  return {
    turf_id: booking.turf_id,
    turf_name: booking.turf_name,
    preferred_start_time: booking.start_time,
    duration_minutes: booking.duration_minutes,
    match_name: match.match_name,
    match_type: match.match_type,
    ball_type: match.ball_type,
    overs_per_innings: match.overs_per_innings,
    scoring_mode: match.scoring_mode,
    roster,
  };
}
