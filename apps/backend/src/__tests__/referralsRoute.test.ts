// Exercises GET /players/:playerId/referrals (long tail — Referral
// System, PRD §12.53). Only `sequelize` is faked.

const USER_ID = 'aaaaaaaa-0000-4000-8000-002101';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-002102';

let referrals: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
          return r.userId === USER_ID ? [{ player_id: PLAYER_ID }] : [];
        }
        if (sql.includes('FROM referrals r') && sql.includes('JOIN players p')) {
          return referrals;
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

describe('GET /players/:playerId/referrals (long tail — PRD §12.53)', () => {
  beforeEach(() => {
    referrals = [
      {
        referral_id: 'ref-1',
        referred_player_id: 'p2',
        referred_bfam_id: 'BF1002',
        referred_full_name: 'Rohan Mehta',
        status: 'QUALIFIED',
        reward_coins: 100,
        created_at: new Date(),
        qualified_at: new Date(),
      },
    ];
  });

  it("returns the caller's own referrals via the 'me' alias", async () => {
    const token = await tokenFor(USER_ID);
    const res = await request(app)
      .get('/players/me/referrals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({ referred_bfam_id: 'BF1002', status: 'QUALIFIED' });
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/players/me/referrals');
    expect(res.status).toBe(401);
  });
});
