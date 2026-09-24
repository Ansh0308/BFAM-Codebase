// Exercises GET /players/:playerId/match-streaks (long tail — Match
// Streaks, PRD §12.38). Only `sequelize` is faked.

const USER_ID = 'aaaaaaaa-0000-4000-8000-001701';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-001702';

let matchDates: Date[];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          return r.userId === USER_ID ? [{ player_id: PLAYER_ID }] : [];
        }
        if (sql.includes('FROM player_match_statistics s')) {
          return matchDates.map((d) => ({ scheduled_start_time: d }));
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

describe('GET /players/:playerId/match-streaks (long tail — PRD §12.38)', () => {
  beforeEach(() => {
    matchDates = [];
  });

  it('returns zero streaks for a player with no completed matches', async () => {
    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get('/players/me/match-streaks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      current_streak: 0,
      best_streak: 0,
      participated_week_starts: [],
    });
  });

  it('returns computed streaks for a player with match history', async () => {
    matchDates = [new Date('2026-01-05T00:00:00Z'), new Date('2026-01-12T00:00:00Z')];

    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get(`/players/${PLAYER_ID}/match-streaks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.best_streak).toBe(2);
    expect(res.body.participated_week_starts).toHaveLength(2);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/players/me/match-streaks');
    expect(res.status).toBe(401);
  });
});
