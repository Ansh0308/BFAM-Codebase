// API integration tests for module 2.5's PRD §15 guarantees: exactly one
// active membership per player per team, and captain-change as a single
// atomic transaction (never a window with zero or two captains). Only
// `sequelize` is faked — the real routes/services run unmodified.

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
  deleted_at: null;
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
interface PlayerRow {
  player_id: string;
  user_id: string;
  bfam_id: string;
}

const CAPTAIN_USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const CAPTAIN_PLAYER = 'aaaaaaaa-1111-4000-8000-000000000001';
const MEMBER_USER = 'bbbbbbbb-0000-4000-8000-000000000002';
const MEMBER_PLAYER = 'bbbbbbbb-1111-4000-8000-000000000002';
const OUTSIDER_USER = 'cccccccc-0000-4000-8000-000000000003';
const OUTSIDER_PLAYER = 'cccccccc-1111-4000-8000-000000000003';

interface InvitationRow {
  invitation_id: string;
  team_id: string;
  invited_player_id: string;
  invited_by: string;
  status: string;
  created_at: Date;
  responded_at: Date | null;
  expires_at: Date | null;
}

let teams: TeamRow[] = [];
let members: MemberRow[] = [];
let invitations: InvitationRow[] = [];
const players: PlayerRow[] = [CAPTAIN_PLAYER, MEMBER_PLAYER, OUTSIDER_PLAYER].map(
  (playerId, i) => ({
    player_id: playerId,
    user_id: [CAPTAIN_USER, MEMBER_USER, OUTSIDER_USER][i],
    bfam_id: `BF${1000 + i}`,
  }),
);

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [p] : [];
        }
        if (sql.includes('FROM teams WHERE team_id')) {
          const t = teams.find((x) => x.team_id === r.teamId);
          return t ? [t] : [];
        }
        if (
          sql.includes("role_in_team = 'CAPTAIN' AND membership_status = 'ACTIVE'") &&
          sql.includes('WHERE team_id')
        ) {
          return members.filter(
            (m) =>
              m.team_id === r.teamId &&
              m.role_in_team === 'CAPTAIN' &&
              m.membership_status === 'ACTIVE',
          );
        }
        if (sql.includes('FROM team_members WHERE team_id = :teamId AND player_id')) {
          const m = members.find((x) => x.team_id === r.teamId && x.player_id === r.playerId);
          return m ? [m] : [];
        }
        if (sql.includes('FROM teams t JOIN team_members tm')) {
          return teams
            .filter((t) =>
              members.some(
                (m) =>
                  m.team_id === t.team_id &&
                  m.player_id === r.playerId &&
                  m.membership_status === 'ACTIVE',
              ),
            )
            .map((t) => ({
              ...t,
              role_in_team: members.find(
                (m) => m.team_id === t.team_id && m.player_id === r.playerId,
              )!.role_in_team,
            }));
        }
        if (sql.includes('FROM team_members tm JOIN players p')) {
          return members
            .filter((m) => m.team_id === r.teamId && m.membership_status === 'ACTIVE')
            .map((m) => ({ ...m, ...players.find((p) => p.player_id === m.player_id) }));
        }
        if (sql.includes('FROM team_invitations WHERE invitation_id')) {
          const inv = invitations.find((i) => i.invitation_id === r.invitationId);
          return inv ? [inv] : [];
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'teams') teams.push(...(rows as unknown as TeamRow[]));
          if (table === 'team_members') members.push(...(rows as unknown as MemberRow[]));
          if (table === 'team_invitations')
            invitations.push(...(rows as unknown as InvitationRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'team_members') {
            for (const member of members) {
              const matchesTeam = where.team_id === undefined || member.team_id === where.team_id;
              const matchesPlayer =
                where.player_id === undefined || member.player_id === where.player_id;
              const matchesId =
                where.team_member_id === undefined ||
                member.team_member_id === where.team_member_id;
              const matchesRole =
                where.role_in_team === undefined || member.role_in_team === where.role_in_team;
              const matchesStatus =
                where.membership_status === undefined ||
                member.membership_status === where.membership_status;
              if (matchesTeam && matchesPlayer && matchesId && matchesRole && matchesStatus) {
                Object.assign(member, values);
              }
            }
          }
          if (table === 'team_invitations') {
            const invitation = invitations.find((i) => i.invitation_id === where.invitation_id);
            if (invitation) Object.assign(invitation, values);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('Teams (module 2.5)', () => {
  let teamId: string;

  beforeEach(async () => {
    teams = [];
    members = [];
    invitations = [];

    const token = await tokenFor(CAPTAIN_USER);
    const created = await request(app)
      .post('/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ team_name: 'Rajkot Strikers', is_open_for_players: true });
    teamId = created.body.team_id;

    // Add a second active member directly for tests that need one already present.
    members.push({
      team_member_id: 'seed-member-1',
      team_id: teamId,
      player_id: MEMBER_PLAYER,
      role_in_team: 'MEMBER',
      membership_status: 'ACTIVE',
      joined_at: new Date(),
      left_at: null,
    });
  });

  it('creating a team makes the creator its sole active Captain', async () => {
    const captainRows = members.filter(
      (m) =>
        m.team_id === teamId && m.role_in_team === 'CAPTAIN' && m.membership_status === 'ACTIVE',
    );
    expect(captainRows).toHaveLength(1);
    expect(captainRows[0].player_id).toBe(CAPTAIN_PLAYER);
  });

  describe('one active membership per player per team', () => {
    it('rejects removing a player who is already inactive', async () => {
      const token = await tokenFor(CAPTAIN_USER);
      await request(app)
        .delete(`/teams/${teamId}/members/${MEMBER_PLAYER}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .delete(`/teams/${teamId}/members/${MEMBER_PLAYER}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      // Still exactly one membership row for this player on this team.
      expect(
        members.filter((m) => m.team_id === teamId && m.player_id === MEMBER_PLAYER),
      ).toHaveLength(1);
    });

    it('a rejoin after leaving reactivates the existing row instead of creating a duplicate', async () => {
      const memberToken = await tokenFor(MEMBER_USER);
      await request(app)
        .post(`/teams/${teamId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(members.find((m) => m.player_id === MEMBER_PLAYER)?.membership_status).toBe('LEFT');

      const captainToken = await tokenFor(CAPTAIN_USER);
      const invite = await request(app)
        .post(`/teams/${teamId}/invitations`)
        .set('Authorization', `Bearer ${captainToken}`)
        .send({ player_id: MEMBER_PLAYER });
      expect(invite.status).toBe(201);

      await request(app)
        .post(`/teams/invitations/${invite.body.invitation_id}/respond`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ accept: true });

      const rowsForPlayer = members.filter(
        (m) => m.team_id === teamId && m.player_id === MEMBER_PLAYER,
      );
      expect(rowsForPlayer).toHaveLength(1);
      expect(rowsForPlayer[0].membership_status).toBe('ACTIVE');
    });

    it('rejects inviting a player who is already an active member', async () => {
      const token = await tokenFor(CAPTAIN_USER);
      const res = await request(app)
        .post(`/teams/${teamId}/invitations`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player_id: MEMBER_PLAYER });

      expect(res.status).toBe(409);
    });
  });

  describe('captain-change atomicity', () => {
    it('demotes the old captain and promotes the new one in one transaction — never zero or two captains', async () => {
      const token = await tokenFor(CAPTAIN_USER);
      const res = await request(app)
        .post(`/teams/${teamId}/captain`)
        .set('Authorization', `Bearer ${token}`)
        .send({ new_captain_player_id: MEMBER_PLAYER });

      expect(res.status).toBe(204);

      const activeCaptains = members.filter(
        (m) =>
          m.team_id === teamId && m.role_in_team === 'CAPTAIN' && m.membership_status === 'ACTIVE',
      );
      expect(activeCaptains).toHaveLength(1);
      expect(activeCaptains[0].player_id).toBe(MEMBER_PLAYER);

      const oldCaptain = members.find((m) => m.player_id === CAPTAIN_PLAYER);
      expect(oldCaptain?.role_in_team).toBe('MEMBER');
      expect(oldCaptain?.membership_status).toBe('ACTIVE');
    });

    it('rejects a non-captain trying to change the captain', async () => {
      const token = await tokenFor(MEMBER_USER);
      const res = await request(app)
        .post(`/teams/${teamId}/captain`)
        .set('Authorization', `Bearer ${token}`)
        .send({ new_captain_player_id: MEMBER_PLAYER });

      expect(res.status).toBe(403);
      expect(
        members.find((m) => m.role_in_team === 'CAPTAIN' && m.membership_status === 'ACTIVE')
          ?.player_id,
      ).toBe(CAPTAIN_PLAYER);
    });

    it('rejects promoting a player who is not an active member of the team', async () => {
      const token = await tokenFor(CAPTAIN_USER);
      const res = await request(app)
        .post(`/teams/${teamId}/captain`)
        .set('Authorization', `Bearer ${token}`)
        .send({ new_captain_player_id: OUTSIDER_PLAYER });

      expect(res.status).toBe(409);
      expect(
        members.find((m) => m.role_in_team === 'CAPTAIN' && m.membership_status === 'ACTIVE')
          ?.player_id,
      ).toBe(CAPTAIN_PLAYER);
    });

    it('the captain cannot remove themself or leave without transferring captaincy first', async () => {
      const token = await tokenFor(CAPTAIN_USER);

      const removeSelf = await request(app)
        .delete(`/teams/${teamId}/members/${CAPTAIN_PLAYER}`)
        .set('Authorization', `Bearer ${token}`);
      expect(removeSelf.status).toBe(409);

      const leave = await request(app)
        .post(`/teams/${teamId}/leave`)
        .set('Authorization', `Bearer ${token}`);
      expect(leave.status).toBe(409);

      expect(
        members.find((m) => m.role_in_team === 'CAPTAIN' && m.membership_status === 'ACTIVE')
          ?.player_id,
      ).toBe(CAPTAIN_PLAYER);
    });
  });
});
