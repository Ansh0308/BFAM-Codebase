import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  AlreadyTeamMemberError,
  ForbiddenActionError,
  InvalidTeamStateError,
  JoinRequestNotFoundError,
  PlayerProfileNotFoundError,
  TeamNotFoundError,
} from '../domain/errors';
import { sendNotification } from './notificationService';

interface TeamRow {
  team_id: string;
  team_name: string;
  team_logo_url: string | null;
  description: string | null;
  skill_level: string | null;
  home_city: string | null;
  is_open_for_players: boolean;
  team_status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface MemberRow {
  team_member_id: string;
  team_id: string;
  player_id: string;
  role_in_team: string;
  membership_status: string;
  joined_at: Date;
  left_at: Date | null;
}

async function resolvePlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function fetchTeam(teamId: string): Promise<TeamRow | null> {
  const [team] = await sequelize.query<TeamRow>('SELECT * FROM teams WHERE team_id = :teamId', {
    type: QueryTypes.SELECT,
    replacements: { teamId },
  });
  return team ?? null;
}

async function fetchActiveCaptainMembership(teamId: string): Promise<MemberRow | null> {
  const [member] = await sequelize.query<MemberRow>(
    "SELECT * FROM team_members WHERE team_id = :teamId AND role_in_team = 'CAPTAIN' AND membership_status = 'ACTIVE'",
    { type: QueryTypes.SELECT, replacements: { teamId } },
  );
  return member ?? null;
}

async function fetchMembership(teamId: string, playerId: string): Promise<MemberRow | null> {
  const [member] = await sequelize.query<MemberRow>(
    'SELECT * FROM team_members WHERE team_id = :teamId AND player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { teamId, playerId } },
  );
  return member ?? null;
}

async function assertIsCaptain(teamId: string, userId: string) {
  const playerId = await resolvePlayerId(userId);
  const captain = await fetchActiveCaptainMembership(teamId);
  if (!captain || captain.player_id !== playerId) {
    throw new ForbiddenActionError("Only this team's captain can do that.");
  }
  return playerId;
}

export interface CreateTeamInput {
  team_name: string;
  team_logo_url?: string | null;
  description?: string | null;
  skill_level?: string | null;
  home_city?: string | null;
  is_open_for_players?: boolean;
}

// Creates a team and, in the same transaction, makes the creator its first
// (and only) active Captain — the DB's `uk_one_active_captain_per_team`
// generated-column unique index (Phase 1) is what actually guarantees
// "exactly one active Captain per team at any time" (PRD §15); this just
// has to never violate it.
export async function createTeam(userId: string, input: CreateTeamInput) {
  const playerId = await resolvePlayerId(userId);
  const now = new Date();
  const teamId = randomUUID();

  await sequelize.transaction(async (transaction) => {
    await sequelize.getQueryInterface().bulkInsert(
      'teams',
      [
        {
          team_id: teamId,
          team_name: input.team_name,
          team_logo_url: input.team_logo_url ?? null,
          description: input.description ?? null,
          skill_level: input.skill_level ?? null,
          home_city: input.home_city ?? null,
          is_open_for_players: input.is_open_for_players ?? false,
          team_status: 'ACTIVE',
          created_by: userId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ],
      { transaction },
    );

    await sequelize.getQueryInterface().bulkInsert(
      'team_members',
      [
        {
          team_member_id: randomUUID(),
          team_id: teamId,
          player_id: playerId,
          role_in_team: 'CAPTAIN',
          membership_status: 'ACTIVE',
          joined_at: now,
          left_at: null,
        },
      ],
      { transaction },
    );
  });

  return fetchTeam(teamId);
}

export async function getTeamDetails(teamId: string) {
  const team = await fetchTeam(teamId);
  if (!team) throw new TeamNotFoundError(teamId);

  const members = await sequelize.query<
    MemberRow & { bfam_id: string; favorite_cricketer_name: string | null }
  >(
    `SELECT tm.*, p.bfam_id, p.favorite_cricketer_name
     FROM team_members tm JOIN players p ON p.player_id = tm.player_id
     WHERE tm.team_id = :teamId AND tm.membership_status = 'ACTIVE'
     ORDER BY tm.role_in_team ASC, tm.joined_at ASC`,
    { type: QueryTypes.SELECT, replacements: { teamId } },
  );

  return { ...team, members };
}

// My Teams: every team the caller has an ACTIVE membership on.
export async function listMyTeams(userId: string) {
  const playerId = await resolvePlayerId(userId);
  return sequelize.query<TeamRow & { role_in_team: string }>(
    `SELECT t.*, tm.role_in_team
     FROM teams t JOIN team_members tm ON tm.team_id = t.team_id
     WHERE tm.player_id = :playerId AND tm.membership_status = 'ACTIVE' AND t.deleted_at IS NULL
     ORDER BY t.team_name ASC`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
}

export interface OpenTeamFilters {
  skill_level?: string;
  city?: string;
}

// Open Teams: vacancy discovery (PRD §12.4) — map view is not part of this
// module either, same scope note as Turf Discovery.
export async function listOpenTeams(filters: OpenTeamFilters) {
  const conditions = [
    "t.team_status = 'ACTIVE'",
    't.deleted_at IS NULL',
    't.is_open_for_players = TRUE',
  ];
  const replacements: Record<string, unknown> = {};

  if (filters.skill_level) {
    conditions.push('t.skill_level = :skillLevel');
    replacements.skillLevel = filters.skill_level;
  }
  if (filters.city) {
    conditions.push('t.home_city LIKE :city');
    replacements.city = `%${filters.city}%`;
  }

  return sequelize.query<TeamRow & { active_member_count: number }>(
    `SELECT t.*,
       (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.team_id AND tm.membership_status = 'ACTIVE') AS active_member_count
     FROM teams t
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.team_name ASC`,
    { type: QueryTypes.SELECT, replacements },
  );
}

// Invite/add/remove players (PRD §12.3) — captain-only.
export async function inviteToTeam(teamId: string, actorUserId: string, invitedPlayerId: string) {
  await assertIsCaptain(teamId, actorUserId);

  const existing = await fetchMembership(teamId, invitedPlayerId);
  if (existing && existing.membership_status === 'ACTIVE') {
    throw new AlreadyTeamMemberError();
  }

  const invitationId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('team_invitations', [
    {
      invitation_id: invitationId,
      team_id: teamId,
      invited_player_id: invitedPlayerId,
      invited_by: actorUserId,
      status: 'PENDING',
      created_at: now,
      responded_at: null,
      expires_at: null,
    },
  ]);

  // TEAM_INVITE (module 2.11, PRD §12.45). Never allowed to fail the
  // invite itself — see notificationService.sendNotification's contract.
  try {
    const team = await fetchTeam(teamId);
    const [invitedPlayer] = await sequelize.query<{ user_id: string }>(
      'SELECT user_id FROM players WHERE player_id = :playerId',
      { type: QueryTypes.SELECT, replacements: { playerId: invitedPlayerId } },
    );
    if (team && invitedPlayer) {
      await sendNotification({
        userId: invitedPlayer.user_id,
        event: 'TEAM_INVITE',
        params: { teamName: team.team_name },
        relatedEntityType: 'team',
        relatedEntityId: teamId,
      });
    }
  } catch (error) {
    console.error(`[teamService] Failed to send TEAM_INVITE for team ${teamId}:`, error);
  }

  return { invitation_id: invitationId };
}

// A player accepting their own invitation. Handles rejoin-after-leaving:
// `team_members` has a UNIQUE(team_id, player_id) constraint (Phase 1), so a
// player who previously left/was removed already has a row — it must be
// UPDATEd back to ACTIVE rather than re-INSERTed.
export async function respondToInvitation(invitationId: string, userId: string, accept: boolean) {
  const playerId = await resolvePlayerId(userId);
  const [invitation] = await sequelize.query<{
    invitation_id: string;
    team_id: string;
    invited_player_id: string;
    status: string;
  }>('SELECT * FROM team_invitations WHERE invitation_id = :invitationId', {
    type: QueryTypes.SELECT,
    replacements: { invitationId },
  });
  if (!invitation) throw new JoinRequestNotFoundError(invitationId);
  if (invitation.invited_player_id !== playerId) {
    throw new ForbiddenActionError('This invitation is not addressed to you.');
  }
  if (invitation.status !== 'PENDING') {
    throw new InvalidTeamStateError('This invitation has already been responded to.');
  }

  const now = new Date();
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'team_invitations',
      { status: accept ? 'ACCEPTED' : 'REJECTED', responded_at: now },
      { invitation_id: invitationId },
    );

  if (accept) {
    await upsertActiveMembership(invitation.team_id, playerId, 'MEMBER');
  }

  return { invitation_id: invitationId, status: accept ? 'ACCEPTED' : 'REJECTED' };
}

async function upsertActiveMembership(
  teamId: string,
  playerId: string,
  role: 'CAPTAIN' | 'MEMBER',
) {
  const existing = await fetchMembership(teamId, playerId);
  const now = new Date();
  if (existing) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'team_members',
        { membership_status: 'ACTIVE', role_in_team: role, joined_at: now, left_at: null },
        { team_member_id: existing.team_member_id },
      );
  } else {
    await sequelize.getQueryInterface().bulkInsert('team_members', [
      {
        team_member_id: randomUUID(),
        team_id: teamId,
        player_id: playerId,
        role_in_team: role,
        membership_status: 'ACTIVE',
        joined_at: now,
        left_at: null,
      },
    ]);
  }
}

// Remove a player from the team (PRD §12.3) — captain-only, and a captain
// can't remove themself this way (must transfer captaincy first via
// changeCaptain, so a team is never left captain-less).
export async function removeMember(teamId: string, actorUserId: string, targetPlayerId: string) {
  const captainPlayerId = await assertIsCaptain(teamId, actorUserId);
  if (targetPlayerId === captainPlayerId) {
    throw new InvalidTeamStateError(
      'The captain cannot remove themself — transfer captaincy to someone else first.',
    );
  }

  const membership = await fetchMembership(teamId, targetPlayerId);
  if (!membership || membership.membership_status !== 'ACTIVE') {
    throw new InvalidTeamStateError('This player is not an active member of this team.');
  }

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'team_members',
      { membership_status: 'REMOVED', left_at: new Date() },
      { team_member_id: membership.team_member_id },
    );
}

// A member leaving on their own. A captain must transfer captaincy first —
// same "never captain-less" rule as removeMember.
export async function leaveTeam(teamId: string, userId: string) {
  const playerId = await resolvePlayerId(userId);
  const membership = await fetchMembership(teamId, playerId);
  if (!membership || membership.membership_status !== 'ACTIVE') {
    throw new InvalidTeamStateError('You are not an active member of this team.');
  }
  if (membership.role_in_team === 'CAPTAIN') {
    throw new InvalidTeamStateError(
      'The captain cannot leave — transfer captaincy to someone else first.',
    );
  }

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'team_members',
      { membership_status: 'LEFT', left_at: new Date() },
      { team_member_id: membership.team_member_id },
    );
}

// Change Captain (PRD §12.3 / §15): a single atomic transaction that demotes
// the current captain and promotes the new one — never a window with zero
// or two captains. The DB's uk_one_active_captain_per_team unique index is
// the actual guarantee; wrapping both UPDATEs in one transaction is what
// keeps any *other* connection from ever observing the brief zero-captain
// instant between them (MySQL's default REPEATABLE READ + row locking).
export async function changeCaptain(
  teamId: string,
  actorUserId: string,
  newCaptainPlayerId: string,
) {
  const currentCaptainPlayerId = await assertIsCaptain(teamId, actorUserId);
  if (newCaptainPlayerId === currentCaptainPlayerId) {
    throw new InvalidTeamStateError('This player is already the captain.');
  }

  const newCaptainMembership = await fetchMembership(teamId, newCaptainPlayerId);
  if (!newCaptainMembership || newCaptainMembership.membership_status !== 'ACTIVE') {
    throw new InvalidTeamStateError('The new captain must be an active member of this team.');
  }

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'team_members',
        { role_in_team: 'MEMBER' },
        { team_id: teamId, role_in_team: 'CAPTAIN', membership_status: 'ACTIVE' },
        { transaction },
      );
    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'team_members',
        { role_in_team: 'CAPTAIN' },
        { team_member_id: newCaptainMembership.team_member_id },
        { transaction },
      );
  });
}

// Join Team Request flow (PRD §12.4).
export async function requestToJoinTeam(teamId: string, userId: string) {
  const team = await fetchTeam(teamId);
  if (!team) throw new TeamNotFoundError(teamId);
  if (!team.is_open_for_players) {
    throw new InvalidTeamStateError('This team is not currently open for new players.');
  }

  const playerId = await resolvePlayerId(userId);
  const existingMembership = await fetchMembership(teamId, playerId);
  if (existingMembership && existingMembership.membership_status === 'ACTIVE') {
    throw new AlreadyTeamMemberError();
  }

  const [pending] = await sequelize.query<{ request_id: string }>(
    "SELECT request_id FROM team_join_requests WHERE team_id = :teamId AND player_id = :playerId AND status = 'PENDING'",
    { type: QueryTypes.SELECT, replacements: { teamId, playerId } },
  );
  if (pending) {
    throw new InvalidTeamStateError('You already have a pending request to join this team.');
  }

  const requestId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('team_join_requests', [
    {
      request_id: requestId,
      team_id: teamId,
      player_id: playerId,
      status: 'PENDING',
      requested_at: new Date(),
      responded_by: null,
    },
  ]);
  return { request_id: requestId };
}

export async function listJoinRequests(teamId: string, actorUserId: string) {
  await assertIsCaptain(teamId, actorUserId);
  return sequelize.query(
    `SELECT jr.*, p.bfam_id
     FROM team_join_requests jr JOIN players p ON p.player_id = jr.player_id
     WHERE jr.team_id = :teamId AND jr.status = 'PENDING'
     ORDER BY jr.requested_at ASC`,
    { type: QueryTypes.SELECT, replacements: { teamId } },
  );
}

export async function respondToJoinRequest(
  requestId: string,
  actorUserId: string,
  accept: boolean,
) {
  const [joinRequest] = await sequelize.query<{
    request_id: string;
    team_id: string;
    player_id: string;
    status: string;
  }>('SELECT * FROM team_join_requests WHERE request_id = :requestId', {
    type: QueryTypes.SELECT,
    replacements: { requestId },
  });
  if (!joinRequest) throw new JoinRequestNotFoundError(requestId);

  await assertIsCaptain(joinRequest.team_id, actorUserId);

  if (joinRequest.status !== 'PENDING') {
    throw new InvalidTeamStateError('This join request has already been responded to.');
  }

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'team_join_requests',
      { status: accept ? 'ACCEPTED' : 'REJECTED', responded_by: actorUserId },
      { request_id: requestId },
    );

  if (accept) {
    await upsertActiveMembership(joinRequest.team_id, joinRequest.player_id, 'MEMBER');
  }

  return { request_id: requestId, status: accept ? 'ACCEPTED' : 'REJECTED' };
}
