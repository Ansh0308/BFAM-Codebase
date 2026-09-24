// API integration tests for backlog A-10: assigning confirmed roster
// players to a side before scoring can restrict batter/bowler pickers to
// the correct team. Only `sequelize` is faked — the real route/service
// runs unmodified.

interface MatchRow {
  match_id: string;
  organizer_id: string;
  assigned_scorer_id: string | null;
}
interface MatchTeamRow {
  match_team_id: string;
  match_id: string;
  side_label: string;
}
interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  invitation_status: string;
  match_team_id: string | null;
}

const MATCH_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORGANIZER_USER = 'bbbbbbbb-0000-4000-8000-000000000002';
const OUTSIDER_USER = 'cccccccc-0000-4000-8000-000000000003';
const TEAM_A = 'dddddddd-0000-4000-8000-000000000004';
const TEAM_B = 'eeeeeeee-0000-4000-8000-000000000005';
const OTHER_MATCH_TEAM = 'ffffffff-0000-4000-8000-000000000006';
const PLAYER_1 = '11111111-0000-4000-8000-000000000007';
const PLAYER_2 = '22222222-0000-4000-8000-000000000008';
const CANT_PLAY_PLAYER = '33333333-0000-4000-8000-000000000009';

const matches: MatchRow[] = [
  { match_id: MATCH_ID, organizer_id: ORGANIZER_USER, assigned_scorer_id: null },
];
const matchTeams: MatchTeamRow[] = [
  { match_team_id: TEAM_A, match_id: MATCH_ID, side_label: 'TEAM_A' },
  { match_team_id: TEAM_B, match_id: MATCH_ID, side_label: 'TEAM_B' },
];
let matchPlayers: MatchPlayerRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (sql.includes('FROM match_teams mt')) {
          return matchTeams.filter((t) => t.match_id === r.matchId);
        }
        if (
          sql.includes("invitation_status != 'CANT_PLAY'") &&
          sql.includes('SELECT player_id FROM')
        ) {
          return matchPlayers
            .filter((p) => p.match_id === r.matchId && p.invitation_status !== 'CANT_PLAY')
            .map((p) => ({ player_id: p.player_id }));
        }
        if (sql.includes('mp.player_id, p.bfam_id')) {
          // getPlayingXi — not asserted on directly in these tests.
          return [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'match_players') {
            const row = matchPlayers.find(
              (p) => p.match_id === where.match_id && p.player_id === where.player_id,
            );
            if (row) Object.assign(row, values);
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

describe('POST /matches/:matchId/intro/assign-sides (backlog A-10)', () => {
  beforeEach(() => {
    matchPlayers = [
      {
        match_id: MATCH_ID,
        player_id: PLAYER_1,
        invitation_status: 'CONFIRMED',
        match_team_id: null,
      },
      {
        match_id: MATCH_ID,
        player_id: PLAYER_2,
        invitation_status: 'CONFIRMED',
        match_team_id: null,
      },
      {
        match_id: MATCH_ID,
        player_id: CANT_PLAY_PLAYER,
        invitation_status: 'CANT_PLAY',
        match_team_id: null,
      },
    ];
  });

  it('assigns confirmed players to their sides', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/intro/assign-sides`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        assignments: [
          { player_id: PLAYER_1, match_team_id: TEAM_A },
          { player_id: PLAYER_2, match_team_id: TEAM_B },
        ],
      });

    expect(res.status).toBe(200);
    expect(matchPlayers.find((p) => p.player_id === PLAYER_1)?.match_team_id).toBe(TEAM_A);
    expect(matchPlayers.find((p) => p.player_id === PLAYER_2)?.match_team_id).toBe(TEAM_B);
  });

  it('rejects a match_team_id that does not belong to this match', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/intro/assign-sides`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignments: [{ player_id: PLAYER_1, match_team_id: OTHER_MATCH_TEAM }] });

    expect(res.status).toBe(409);
    expect(matchPlayers.find((p) => p.player_id === PLAYER_1)?.match_team_id).toBeNull();
  });

  it('rejects assigning a player who has said they cannot play', async () => {
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/intro/assign-sides`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignments: [{ player_id: CANT_PLAY_PLAYER, match_team_id: TEAM_A }] });

    expect(res.status).toBe(409);
  });

  it('allows assigning a player who has not confirmed yet (PENDING/MAYBE) — only CANT_PLAY is excluded', async () => {
    const PENDING_PLAYER = '44444444-0000-4000-8000-000000000010';
    matchPlayers.push({
      match_id: MATCH_ID,
      player_id: PENDING_PLAYER,
      invitation_status: 'PENDING',
      match_team_id: null,
    });
    const token = await tokenFor(ORGANIZER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/intro/assign-sides`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignments: [{ player_id: PENDING_PLAYER, match_team_id: TEAM_A }] });

    expect(res.status).toBe(200);
    expect(matchPlayers.find((p) => p.player_id === PENDING_PLAYER)?.match_team_id).toBe(TEAM_A);
  });

  it('rejects a non-organizer, non-scorer caller', async () => {
    const token = await tokenFor(OUTSIDER_USER);
    const res = await request(app)
      .post(`/matches/${MATCH_ID}/intro/assign-sides`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignments: [{ player_id: PLAYER_1, match_team_id: TEAM_A }] });

    expect(res.status).toBe(403);
  });
});
