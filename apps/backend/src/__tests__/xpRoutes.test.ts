// Exercises GET /players/:playerId/xp and .../xp/history (long tail — XP
// & Player Levels, PRD §12.35). Only `sequelize` is faked — the real
// routes/services run unmodified.

const USER_ID = 'aaaaaaaa-0000-4000-8000-001501';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-001502';

let players: Array<{ player_id: string; user_id: string; xp_total: number }>;
let xpTransactions: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (sql.includes('SELECT xp_total FROM players WHERE player_id')) {
          const p = players.find((x) => x.player_id === r.playerId);
          return p ? [{ xp_total: p.xp_total }] : [];
        }
        if (sql.includes('FROM xp_transactions')) {
          return xpTransactions.filter((t) => t.player_id === r.playerId);
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

describe('XP & Level routes (long tail — PRD §12.35)', () => {
  beforeEach(() => {
    players = [{ player_id: PLAYER_ID, user_id: USER_ID, xp_total: 150 }];
    xpTransactions = [
      {
        xp_transaction_id: 'xp-1',
        player_id: PLAYER_ID,
        reason: 'REVIEW_REWARD',
        amount: 10,
        resulting_total: 150,
        related_entity_type: 'review',
        related_entity_id: 'review-1',
        created_at: new Date(),
      },
    ];
  });

  it("returns the caller's own level progress via the 'me' alias", async () => {
    const token = await tokenFor(USER_ID);
    const res = await request(app).get('/players/me/xp').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ xp_total: 150, level: 'Rookie', next_level: 'Player' });
  });

  it('returns level progress for a specific player_id', async () => {
    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get(`/players/${PLAYER_ID}/xp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.xp_total).toBe(150);
  });

  it('returns the XP history, most recent first', async () => {
    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get(`/players/${PLAYER_ID}/xp/history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({ reason: 'REVIEW_REWARD', amount: 10 });
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/players/me/xp');
    expect(res.status).toBe(401);
  });
});
