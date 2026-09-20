// API integration tests for backlog B-13: Team vs Team Challenge Mode.
// Only `sequelize` is faked — the real routes/services run unmodified.
// Notification sends are best-effort (teamService wraps them in try/catch,
// and notificationService catches internally too), so unmocked
// notification-lookup queries are allowed to fail silently rather than
// needing full fixtures here.

interface TeamRow {
  team_id: string;
  team_name: string;
  is_open_for_challenge: boolean;
  team_status: string;
  deleted_at: string | null;
}
interface MemberRow {
  team_id: string;
  player_id: string;
  role_in_team: string;
  membership_status: string;
}
interface ChallengeRow {
  challenge_id: string;
  challenging_team_id: string;
  challenged_team_id: string;
  status: string;
  initiated_by: string;
  responded_by: string | null;
  created_at: Date;
  responded_at: Date | null;
}

const CAPTAIN_A_USER = 'aaaaaaaa-0000-4000-8000-000000001301';
const CAPTAIN_A_PLAYER = 'aaaaaaaa-1111-4000-8000-000000001301';
const CAPTAIN_B_USER = 'bbbbbbbb-0000-4000-8000-000000001302';
const CAPTAIN_B_PLAYER = 'bbbbbbbb-1111-4000-8000-000000001302';
const OUTSIDER_USER = 'cccccccc-0000-4000-8000-000000001303';
const OUTSIDER_PLAYER = 'cccccccc-1111-4000-8000-000000001303';
const TEAM_A = 'dddddddd-0000-4000-8000-000000001304';
const TEAM_B = 'eeeeeeee-0000-4000-8000-000000001305';

let teams: TeamRow[] = [];
let members: MemberRow[] = [];
let challenges: ChallengeRow[] = [];
const inserted: { table: string; row: Record<string, unknown> }[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const map: Record<string, string> = {
            [CAPTAIN_A_USER]: CAPTAIN_A_PLAYER,
            [CAPTAIN_B_USER]: CAPTAIN_B_PLAYER,
            [OUTSIDER_USER]: OUTSIDER_PLAYER,
          };
          const playerId = map[r.userId as string];
          return playerId ? [{ player_id: playerId }] : [];
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
        if (sql.includes('FROM team_challenges WHERE challenge_id')) {
          const c = challenges.find((x) => x.challenge_id === r.challengeId);
          return c ? [c] : [];
        }
        if (sql.includes('FROM team_challenges') && sql.includes("status = 'PENDING'")) {
          return challenges.filter(
            (c) =>
              c.challenging_team_id === r.challengingTeamId &&
              c.challenged_team_id === r.challengedTeamId &&
              c.status === 'PENDING',
          );
        }
        if (sql.includes('SELECT user_id FROM players WHERE player_id')) {
          return [];
        }
        if (sql.includes('FROM team_challenges tc')) {
          const captainedTeamIds = members
            .filter(
              (m) =>
                m.player_id === r.playerId &&
                m.role_in_team === 'CAPTAIN' &&
                m.membership_status === 'ACTIVE',
            )
            .map((m) => m.team_id);
          return challenges
            .filter(
              (c) =>
                captainedTeamIds.includes(c.challenging_team_id) ||
                captainedTeamIds.includes(c.challenged_team_id),
            )
            .map((c) => ({
              ...c,
              challenging_team_name: teams.find((t) => t.team_id === c.challenging_team_id)!
                .team_name,
              challenged_team_name: teams.find((t) => t.team_id === c.challenged_team_id)!
                .team_name,
            }));
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          for (const row of rows) {
            inserted.push({ table, row });
            if (table === 'team_challenges') challenges.push(row as unknown as ChallengeRow);
          }
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'teams') {
            const t = teams.find((x) => x.team_id === where.team_id);
            if (t) Object.assign(t, values);
          }
          if (table === 'team_challenges') {
            const c = challenges.find((x) => x.challenge_id === where.challenge_id);
            if (c) Object.assign(c, values);
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

describe('Team vs Team Challenge Mode (backlog B-13)', () => {
  beforeEach(() => {
    teams = [
      {
        team_id: TEAM_A,
        team_name: 'Alpha XI',
        is_open_for_challenge: false,
        team_status: 'ACTIVE',
        deleted_at: null,
      },
      {
        team_id: TEAM_B,
        team_name: 'Beta XI',
        is_open_for_challenge: true,
        team_status: 'ACTIVE',
        deleted_at: null,
      },
    ];
    members = [
      {
        team_id: TEAM_A,
        player_id: CAPTAIN_A_PLAYER,
        role_in_team: 'CAPTAIN',
        membership_status: 'ACTIVE',
      },
      {
        team_id: TEAM_B,
        player_id: CAPTAIN_B_PLAYER,
        role_in_team: 'CAPTAIN',
        membership_status: 'ACTIVE',
      },
    ];
    challenges = [];
    inserted.length = 0;
  });

  it('lets a captain open their team for challenges', async () => {
    const token = await tokenFor(CAPTAIN_A_USER);
    const res = await request(app)
      .post(`/teams/${TEAM_A}/open-for-challenge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_open_for_challenge: true });

    expect(res.status).toBe(200);
    expect(teams.find((t) => t.team_id === TEAM_A)!.is_open_for_challenge).toBe(true);
  });

  it('rejects a non-captain trying to toggle open-for-challenge', async () => {
    const token = await tokenFor(OUTSIDER_USER);
    const res = await request(app)
      .post(`/teams/${TEAM_A}/open-for-challenge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_open_for_challenge: true });

    expect(res.status).toBe(403);
  });

  it('lets a captain send a challenge to a team open for challenges', async () => {
    const token = await tokenFor(CAPTAIN_A_USER);
    const res = await request(app)
      .post(`/teams/${TEAM_A}/challenges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ challenged_team_id: TEAM_B });

    expect(res.status).toBe(201);
    expect(challenges).toHaveLength(1);
    expect(challenges[0].status).toBe('PENDING');
  });

  it('rejects challenging a team that is not open for challenges', async () => {
    const token = await tokenFor(CAPTAIN_B_USER);
    const res = await request(app)
      .post(`/teams/${TEAM_B}/challenges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ challenged_team_id: TEAM_A });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/not currently open for challenges/i);
  });

  it('rejects a team challenging itself', async () => {
    const token = await tokenFor(CAPTAIN_A_USER);
    const res = await request(app)
      .post(`/teams/${TEAM_A}/challenges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ challenged_team_id: TEAM_A });

    expect(res.status).toBe(409);
  });

  it('rejects a duplicate pending challenge to the same team', async () => {
    const token = await tokenFor(CAPTAIN_A_USER);
    await request(app)
      .post(`/teams/${TEAM_A}/challenges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ challenged_team_id: TEAM_B });

    const res = await request(app)
      .post(`/teams/${TEAM_A}/challenges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ challenged_team_id: TEAM_B });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already have a pending challenge/i);
  });

  it("lets the challenged team's captain accept a challenge", async () => {
    challenges.push({
      challenge_id: 'ffffffff-0000-4000-8000-000000001306',
      challenging_team_id: TEAM_A,
      challenged_team_id: TEAM_B,
      status: 'PENDING',
      initiated_by: CAPTAIN_A_USER,
      responded_by: null,
      created_at: new Date(),
      responded_at: null,
    });

    const token = await tokenFor(CAPTAIN_B_USER);
    const res = await request(app)
      .post(`/teams/challenges/${challenges[0].challenge_id}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accept: true });

    expect(res.status).toBe(200);
    expect(challenges[0].status).toBe('ACCEPTED');
  });

  it('rejects a captain from the wrong team responding to a challenge', async () => {
    challenges.push({
      challenge_id: 'ffffffff-0000-4000-8000-000000001307',
      challenging_team_id: TEAM_A,
      challenged_team_id: TEAM_B,
      status: 'PENDING',
      initiated_by: CAPTAIN_A_USER,
      responded_by: null,
      created_at: new Date(),
      responded_at: null,
    });

    const token = await tokenFor(CAPTAIN_A_USER);
    const res = await request(app)
      .post(`/teams/challenges/${challenges[0].challenge_id}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accept: true });

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent challenge', async () => {
    const token = await tokenFor(CAPTAIN_B_USER);
    const res = await request(app)
      .post('/teams/challenges/00000000-0000-4000-8000-000000000000/respond')
      .set('Authorization', `Bearer ${token}`)
      .send({ accept: true });

    expect(res.status).toBe(404);
  });

  it('lets the challenger cancel a still-pending challenge', async () => {
    challenges.push({
      challenge_id: 'ffffffff-0000-4000-8000-000000001308',
      challenging_team_id: TEAM_A,
      challenged_team_id: TEAM_B,
      status: 'PENDING',
      initiated_by: CAPTAIN_A_USER,
      responded_by: null,
      created_at: new Date(),
      responded_at: null,
    });

    const token = await tokenFor(CAPTAIN_A_USER);
    const res = await request(app)
      .post(`/teams/challenges/${challenges[0].challenge_id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(challenges[0].status).toBe('CANCELLED');
  });

  it('rejects responding to a challenge that is no longer pending', async () => {
    challenges.push({
      challenge_id: 'ffffffff-0000-4000-8000-000000001309',
      challenging_team_id: TEAM_A,
      challenged_team_id: TEAM_B,
      status: 'ACCEPTED',
      initiated_by: CAPTAIN_A_USER,
      responded_by: CAPTAIN_B_USER,
      created_at: new Date(),
      responded_at: new Date(),
    });

    const token = await tokenFor(CAPTAIN_B_USER);
    const res = await request(app)
      .post(`/teams/challenges/${challenges[0].challenge_id}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accept: false });

    expect(res.status).toBe(409);
  });

  it('lists challenges involving a team the caller captains, on either side', async () => {
    challenges.push({
      challenge_id: 'ffffffff-0000-4000-8000-000000001310',
      challenging_team_id: TEAM_A,
      challenged_team_id: TEAM_B,
      status: 'PENDING',
      initiated_by: CAPTAIN_A_USER,
      responded_by: null,
      created_at: new Date(),
      responded_at: null,
    });

    const tokenA = await tokenFor(CAPTAIN_A_USER);
    const resA = await request(app)
      .get('/teams/challenges/mine')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.results).toHaveLength(1);

    const tokenB = await tokenFor(CAPTAIN_B_USER);
    const resB = await request(app)
      .get('/teams/challenges/mine')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.results).toHaveLength(1);

    const tokenOutsider = await tokenFor(OUTSIDER_USER);
    const resOutsider = await request(app)
      .get('/teams/challenges/mine')
      .set('Authorization', `Bearer ${tokenOutsider}`);
    expect(resOutsider.status).toBe(200);
    expect(resOutsider.body.results).toHaveLength(0);
  });
});
