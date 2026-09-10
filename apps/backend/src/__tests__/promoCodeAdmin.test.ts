// API integration test for backlog B-1's ADMIN-only promo code creation.
// Only `sequelize` is faked — the real route/service runs unmodified.

const ADMIN_USER = 'aaaaaaaa-0000-4000-8000-000000000701';
const PLAYER_USER = 'bbbbbbbb-0000-4000-8000-000000000702';

const promoCodes: Record<string, unknown>[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string) => {
        if (sql.includes('FROM promo_codes ORDER BY created_at DESC')) return promoCodes;
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'promo_codes') promoCodes.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(userId: string, role: 'ADMIN' | 'PLAYER') {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('POST /admin/promo-codes (backlog B-1)', () => {
  beforeEach(() => {
    promoCodes.length = 0;
  });

  it('lets an admin create a promo code', async () => {
    const token = await tokenFor(ADMIN_USER, 'ADMIN');
    const res = await request(app)
      .post('/admin/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'launch20', discount_type: 'PERCENTAGE', discount_value: 20 });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('LAUNCH20');
    expect(promoCodes).toHaveLength(1);
  });

  it('rejects a non-admin caller', async () => {
    const token = await tokenFor(PLAYER_USER, 'PLAYER');
    const res = await request(app)
      .post('/admin/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'LAUNCH20', discount_type: 'PERCENTAGE', discount_value: 20 });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload', async () => {
    const token = await tokenFor(ADMIN_USER, 'ADMIN');
    const res = await request(app)
      .post('/admin/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'X', discount_type: 'PERCENTAGE', discount_value: -5 });

    expect(res.status).toBe(400);
  });
});
