import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { getIo, matchRoom } from '../realtime/io';
import { sendNotificationToMany } from './notificationService';
import { notifyFollowersOfMatchStart } from './followService';
import {
  ForbiddenActionError,
  InvalidMatchStateError,
  MatchIntroNotFoundError,
  MatchNotFoundError,
} from '../domain/errors';

interface MatchRow {
  match_id: string;
  booking_id: string;
  match_name: string | null;
  organizer_id: string;
  assigned_scorer_id: string | null;
}

interface MatchIntroRow {
  intro_id: string;
  match_id: string;
  countdown_enabled: boolean;
  background_music_enabled: boolean;
  playing_xi_confirmed_team_a: boolean;
  playing_xi_confirmed_team_b: boolean;
  toss_winner_match_team_id: string | null;
  toss_decision: 'BAT' | 'BOWL' | null;
  toss_completed_at: Date | null;
  intro_played_at: Date | null;
}

interface PlayingXiPlayer {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  participant_role: string;
  side_label: string | null;
}

async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const [match] = await sequelize.query<MatchRow>(
    'SELECT match_id, booking_id, match_name, organizer_id, assigned_scorer_id FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return match ?? null;
}

async function assertCanManage(match: MatchRow, actorUserId: string) {
  if (match.organizer_id === actorUserId || match.assigned_scorer_id === actorUserId) return;
  throw new ForbiddenActionError('Only the match organizer or assigned scorer can do that.');
}

async function fetchIntro(matchId: string): Promise<MatchIntroRow | null> {
  const [row] = await sequelize.query<MatchIntroRow>(
    'SELECT * FROM match_intro WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return row ?? null;
}

// Playing XI (PRD §12.61 requirement 3): derived live from match_players,
// never hardcoded/separately stored. Feedback: gating this on who has
// tapped Confirm in the app blocked scoring for players who showed up but
// never responded — everyone except a player who explicitly said they
// can't play is included (PENDING/MAYBE/NO_RESPONSE all still show up).
// side_label is null until assignPlayerSides (backlog A-10) has been run
// for a player — the mobile reveal screen falls back to a single unified
// list when it's still null for everyone (e.g. an older match, or before
// the organizer has assigned sides yet).
async function getPlayingXi(matchId: string): Promise<PlayingXiPlayer[]> {
  return sequelize.query<PlayingXiPlayer>(
    `SELECT mp.player_id, p.bfam_id, p.full_name, mp.participant_role, mt.side_label
     FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     LEFT JOIN match_teams mt ON mt.match_team_id = mp.match_team_id
     WHERE mp.match_id = :matchId AND mp.invitation_status != 'CANT_PLAY'
     ORDER BY mp.participant_role ASC, mp.added_at ASC`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
}

interface MatchTeamRow {
  match_team_id: string;
  side_label: 'TEAM_A' | 'TEAM_B';
  // Name set on Match Setup, else the linked real team's name; null falls
  // back to "Team A"/"Team B" on the client.
  team_name: string | null;
}

// Toss capture needs a real match_team_id per side — always available
// (createMatch always makes two ad-hoc TEAM_A/TEAM_B rows), independent
// of whether individual players have been assigned to a side yet via
// assignPlayerSides (backlog A-10).
async function getMatchTeams(matchId: string): Promise<MatchTeamRow[]> {
  return sequelize.query<MatchTeamRow>(
    `SELECT mt.match_team_id, mt.side_label, COALESCE(mt.team_name, t.team_name) AS team_name
     FROM match_teams mt
     LEFT JOIN teams t ON t.team_id = mt.team_id
     WHERE mt.match_id = :matchId
     ORDER BY mt.side_label ASC`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
}

async function getStadiumSoundEnabled(bookingId: string): Promise<boolean> {
  const [row] = await sequelize.query<{ stadium_sound_enabled: boolean }>(
    `SELECT t.stadium_sound_enabled
     FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
     WHERE b.booking_id = :bookingId`,
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
  return row?.stadium_sound_enabled ?? true;
}

function broadcastStage(matchId: string, stage: string, data: unknown) {
  getIo()?.to(matchRoom(matchId)).emit('match:intro_stage', { matchId, stage, data });
}

// Start Match (PRD §12.61 requirement 1): creates the match_intro record.
// Idempotent — this is a one-time sequence, so re-entering (e.g. the
// organizer's app backgrounded and they tap Start Match again) just
// resumes the existing record instead of erroring or duplicating it.
// Backlog A-26: idempotent now also means "quiet" — a re-entry returns
// the current intro/players/matchTeams for the caller to resolve their
// own resume point from, without broadcasting COUNTDOWN and forcing
// every other viewer back to the start.
export async function startIntro(matchId: string, actorUserId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  let intro = await fetchIntro(matchId);
  const isFirstStart = !intro;
  if (!intro) {
    const introId = randomUUID();
    const backgroundMusicEnabled = await getStadiumSoundEnabled(match.booking_id);
    await sequelize.getQueryInterface().bulkInsert('match_intro', [
      {
        intro_id: introId,
        match_id: matchId,
        countdown_enabled: true,
        background_music_enabled: backgroundMusicEnabled,
        playing_xi_confirmed_team_a: false,
        playing_xi_confirmed_team_b: false,
        toss_winner_match_team_id: null,
        toss_decision: null,
        toss_completed_at: null,
        intro_played_at: new Date(),
      },
    ]);
    // A-26: this is the one place a match actually transitions into
    // IN_PROGRESS — match_status has always had this value defined, but
    // nothing ever set it before now.
    await sequelize
      .getQueryInterface()
      .bulkUpdate('matches', { match_status: 'IN_PROGRESS' }, { match_id: matchId });
    intro = await fetchIntro(matchId);
  }

  const [players, matchTeams] = await Promise.all([getPlayingXi(matchId), getMatchTeams(matchId)]);
  // A-26: only the actual first start should force every connected
  // viewer's screen back to COUNTDOWN — a re-entry (organizer's app
  // backgrounded, or a second "Start Match" tap) must not reset anyone
  // else mid-toss or mid-innings. A re-entering caller instead resolves
  // their own resume point from getIntroContext/getLiveScore (see the
  // mobile Match Intro screen), not from this broadcast.
  if (isFirstStart) {
    broadcastStage(matchId, 'COUNTDOWN', { players });
  }

  // MATCH_STARTING (module 2.11, PRD §12.45) — only on the actual first
  // start, not a resumed re-entry into an already-started intro. Never
  // allowed to fail Start Match itself — see notificationService.
  if (isFirstStart && players.length > 0) {
    try {
      const recipients = await sequelize.query<{ user_id: string }>(
        `SELECT p.user_id FROM match_players mp
         JOIN players p ON p.player_id = mp.player_id
         WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED'`,
        { type: QueryTypes.SELECT, replacements: { matchId } },
      );
      await sendNotificationToMany(
        recipients.map((r) => r.user_id),
        'MATCH_STARTING',
        { matchName: match.match_name ?? 'Your match' },
        'match',
        matchId,
      );
    } catch (error) {
      console.error(`[matchIntroService] Failed to send MATCH_STARTING for ${matchId}:`, error);
    }

    // Backlog B-9: tell followers of anyone on this roster that they just
    // started playing — same first-start-only condition as MATCH_STARTING
    // above, and never allowed to fail Start Match (see the function's own
    // internal try/catch).
    await notifyFollowersOfMatchStart(
      matchId,
      match.match_name,
      players.map((p) => p.player_id),
    );
  }

  return { intro, players, matchTeams };
}

export async function getIntroContext(matchId: string) {
  const intro = await fetchIntro(matchId);
  if (!intro) throw new MatchIntroNotFoundError(matchId);
  const [players, matchTeams] = await Promise.all([getPlayingXi(matchId), getMatchTeams(matchId)]);
  return { intro, players, matchTeams };
}

// Assign Players to a Side (backlog A-10) — the step this project's own
// module 2.7 review already flagged as missing: match_players.match_team_id
// was never populated anywhere, so the Scoring Interface had no way to
// restrict a striker/non-striker/bowler pick to the correct side. Every
// CONFIRMED roster player must be assigned to exactly one of the match's
// two match_teams rows before scoring can filter by side — done here as
// one atomic bulk update, most naturally called right after the Playing
// XI reveal and before the toss (per the backlog's own suggested
// placement), but idempotent so it can be re-run if the organizer needs
// to correct a mistake before scoring starts.
export interface SideAssignment {
  player_id: string;
  match_team_id: string;
}

export async function assignPlayerSides(
  matchId: string,
  actorUserId: string,
  assignments: SideAssignment[],
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  const [matchTeams, eligiblePlayers] = await Promise.all([
    getMatchTeams(matchId),
    sequelize.query<{ player_id: string }>(
      `SELECT player_id FROM match_players WHERE match_id = :matchId AND invitation_status != 'CANT_PLAY'`,
      { type: QueryTypes.SELECT, replacements: { matchId } },
    ),
  ]);
  const validTeamIds = new Set(matchTeams.map((t) => t.match_team_id));
  const eligiblePlayerIds = new Set(eligiblePlayers.map((p) => p.player_id));

  for (const a of assignments) {
    if (!validTeamIds.has(a.match_team_id)) {
      throw new InvalidMatchStateError('One of the selected sides does not belong to this match.');
    }
    if (!eligiblePlayerIds.has(a.player_id)) {
      throw new InvalidMatchStateError(
        "Only a player who hasn't said they can't play can be assigned to a side.",
      );
    }
  }

  await sequelize.transaction(async (transaction) => {
    for (const a of assignments) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'match_players',
          { match_team_id: a.match_team_id },
          { match_id: matchId, player_id: a.player_id },
          { transaction },
        );
    }
  });

  const players = await getPlayingXi(matchId);
  broadcastStage(matchId, 'SIDES_ASSIGNED', { players });
  return { players };
}

// Playing XI reveal confirmation — the derived CONFIRMED roster IS the XI
// (no separate lineup-building step in this MVP), so "confirming" per
// side just flips the flag once its captain has seen the reveal.
export async function confirmPlayingXi(
  matchId: string,
  actorUserId: string,
  side: 'TEAM_A' | 'TEAM_B',
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  const column = side === 'TEAM_A' ? 'playing_xi_confirmed_team_a' : 'playing_xi_confirmed_team_b';
  await sequelize
    .getQueryInterface()
    .bulkUpdate('match_intro', { [column]: true }, { match_id: matchId });

  const players = await getPlayingXi(matchId);
  broadcastStage(matchId, 'XI_REVEAL', { players });
  return { players };
}

// Toss result capture + display (PRD §12.61 requirement 5).
export async function recordToss(
  matchId: string,
  actorUserId: string,
  tossWinnerMatchTeamId: string,
  decision: 'BAT' | 'BOWL',
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  const now = new Date();
  await sequelize.getQueryInterface().bulkUpdate(
    'match_intro',
    {
      toss_winner_match_team_id: tossWinnerMatchTeamId,
      toss_decision: decision,
      toss_completed_at: now,
    },
    { match_id: matchId },
  );

  const payload = { toss_winner_match_team_id: tossWinnerMatchTeamId, toss_decision: decision };
  broadcastStage(matchId, 'TOSS', payload);
  return payload;
}

// The sequence's final stage — hands off to Live Scoring (module 2.8).
// Module 2.7's own scope ends here; this just emits so viewers transition
// their screen away from the intro in sync.
export async function completeIntro(matchId: string, actorUserId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);
  broadcastStage(matchId, 'DONE', {});
}

// Match Setup (see .claude/MATCH_REVAMP_PLAN.md) — everything the organizer
// decides before the first ball: what each side is called, overs, and the
// rules. Only allowed until an innings exists; after that the rules are
// baked into the balls already recorded.
export interface MatchSetupInput {
  team_names?: { match_team_id: string; team_name: string | null }[];
  overs_per_innings?: number;
  no_non_striker?: boolean;
  extras_count_toward_score?: boolean;
}

export async function updateMatchSetup(
  matchId: string,
  actorUserId: string,
  input: MatchSetupInput,
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanManage(match, actorUserId);

  const [{ count }] = await sequelize.query<{ count: string | number }>(
    'SELECT COUNT(*) AS count FROM innings WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (Number(count) > 0) {
    throw new InvalidMatchStateError('Match setup can no longer be changed — scoring has started.');
  }

  if (input.team_names?.length) {
    const validIds = new Set((await getMatchTeams(matchId)).map((t) => t.match_team_id));
    for (const t of input.team_names) {
      if (!validIds.has(t.match_team_id)) {
        throw new InvalidMatchStateError(
          'One of the selected sides does not belong to this match.',
        );
      }
    }
  }

  const matchUpdates: Record<string, unknown> = {};
  if (input.overs_per_innings !== undefined)
    matchUpdates.overs_per_innings = input.overs_per_innings;
  if (input.no_non_striker !== undefined) matchUpdates.no_non_striker = input.no_non_striker;
  if (input.extras_count_toward_score !== undefined) {
    matchUpdates.extras_count_toward_score = input.extras_count_toward_score;
  }

  await sequelize.transaction(async (transaction) => {
    if (Object.keys(matchUpdates).length > 0) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'matches',
          { ...matchUpdates, updated_at: new Date() },
          { match_id: matchId },
          { transaction },
        );
    }
    for (const t of input.team_names ?? []) {
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'match_teams',
          { team_name: t.team_name?.trim() || null },
          { match_team_id: t.match_team_id, match_id: matchId },
          { transaction },
        );
    }
  });

  return { matchTeams: await getMatchTeams(matchId) };
}
