// Exercises GET /players/:playerId/achievements (long tail —
// Achievements & Badges, PRD §12.37). Only `sequelize` is faked — the
// real route/service run unmodified.

const USER_ID = 'aaaaaaaa-0000-4000-8000-001601';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-001602';

let matchStatRows: Array<Record<string, unknown>>;
let deliveries: Array<Record<string, unknown>>;
let players: Array<{
  player_id: string;
  user_id: string;
  xp_total: number;
  fair_play_rating: number;
  reliability_score: number;
}>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (sql.includes('FROM player_match_statistics s')) {
          return matchStatRows;
        }
        if (sql.includes('FROM score_events se')) {
          return deliveries;
        }
        if (sql.includes('SELECT xp_total FROM players WHERE player_id')) {
          const p = players.find((x) => x.player_id === r.playerId);
          return p ? [{ xp_total: p.xp_total }] : [];
        }
        if (sql.includes('SELECT fair_play_rating, reliability_score FROM players')) {
          const p = players.find((x) => x.player_id === r.playerId);
          return p
            ? [{ fair_play_rating: p.fair_play_rating, reliability_score: p.reliability_score }]
            : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('GET /players/:playerId/achievements (long tail — PRD §12.37)', () => {
  beforeEach(() => {
    matchStatRows = [
      {
        runs_scored: 120,
        sixes: 30,
        scheduled_start_time: new Date('2026-01-01'),
        is_potm: true,
        team_won: true,
      },
    ];
    deliveries = [];
    players = [
      {
        player_id: PLAYER_ID,
        user_id: USER_ID,
        xp_total: 0,
        fair_play_rating: 100,
        reliability_score: 100,
      },
    ];
  });

  it('earns multiple achievements from a strong match record', async () => {
    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get('/players/me/achievements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(
      res.body.results.map((r: { id: string; earned: boolean }) => [r.id, r.earned]),
    );
    expect(byId.FIRST_MATCH).toBe(true);
    expect(byId.CENTURY_CLUB).toBe(true);
    expect(byId.SIX_MACHINE).toBe(true);
    expect(byId.TOP_PERFORMER).toBe(true);
    expect(byId.FAIR_PLAY_CHAMPION).toBe(true);
    expect(byId.RELIABLE_PLAYER).toBe(true);
    expect(byId.HAT_TRICK_HERO).toBe(false);
    // Only 1 win on record — MATCH_STREAK needs 3+ consecutive.
    expect(byId.MATCH_STREAK).toBe(false);
  });

  it('returns every achievement unearned for a brand-new player', async () => {
    matchStatRows = [];
    players[0].fair_play_rating = 100;
    players[0].reliability_score = 100;

    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get('/players/me/achievements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const firstMatch = res.body.results.find((r: { id: string }) => r.id === 'FIRST_MATCH');
    expect(firstMatch.earned).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/players/me/achievements');
    expect(res.status).toBe(401);
  });
});
