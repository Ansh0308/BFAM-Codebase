// Long tail — Memberships (PRD §12.51): pure expiry rule + service/routes.
// Only `sequelize` is faked.

const USER_ID = 'aaaaaaaa-0000-4000-8000-002301';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-002302';
const PLAN_ID = 'cccccccc-0000-4000-8000-002303';

let plans: Array<Record<string, unknown>>;
let memberships: Array<Record<string, unknown>>;
let coinBalance: number;
let coinTransactions: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
        return r.userId === USER_ID ? [{ player_id: PLAYER_ID }] : [];
      }
      if (sql.includes('FROM membership_plans') && sql.includes('plan_id = :planId')) {
        return plans.filter((x) => x.plan_id === r.planId && x.is_active);
      }
      if (sql.includes('FROM membership_plans')) {
        return plans.filter((x) => x.is_active);
      }
      if (sql.includes('FROM player_memberships pm')) {
        const now = (r.now as Date).getTime();
        return memberships
          .filter((m) => (m.expires_at as Date).getTime() > now)
          .map((m) => ({ ...m, plan_name: 'Monthly Member', discount_percent: 10 }));
      }
      if (sql.includes('SELECT coin_balance FROM players')) {
        return [{ coin_balance: coinBalance }];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
        if (table === 'player_memberships') memberships.push(...rows);
        if (table === 'coin_transactions') coinTransactions.push(...rows);
      },
      bulkUpdate: async (table: string, values: Record<string, unknown>) => {
        if (table === 'players' && 'coin_balance' in values) {
          coinBalance = values.coin_balance as number;
        }
      },
    }),
  },
}));

import request from 'supertest';
import app from '../app';
import { computeNewExpiry } from '../services/membershipService';

async function token() {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: USER_ID });
  return res.body.token as string;
}

const DAY = 24 * 60 * 60 * 1000;

describe('computeNewExpiry', () => {
  const now = new Date('2026-09-24T00:00:00Z');

  it('starts from now when there is no membership', () => {
    const { expiresAt } = computeNewExpiry(now, null, 30);
    expect(expiresAt.getTime()).toBe(now.getTime() + 30 * DAY);
  });

  it('starts from now when the previous membership has lapsed', () => {
    const { expiresAt } = computeNewExpiry(new Date(now), new Date(now.getTime() - DAY), 30);
    expect(expiresAt.getTime()).toBe(now.getTime() + 30 * DAY);
  });

  it('extends from the current expiry when still active', () => {
    const current = new Date(now.getTime() + 10 * DAY);
    const { expiresAt } = computeNewExpiry(now, current, 30);
    expect(expiresAt.getTime()).toBe(current.getTime() + 30 * DAY);
  });
});

describe('Memberships (long tail — PRD §12.51)', () => {
  beforeEach(() => {
    plans = [
      {
        plan_id: PLAN_ID,
        name: 'Monthly Member',
        duration_days: 30,
        coin_cost: 1500,
        discount_percent: 10,
        is_active: true,
      },
      {
        plan_id: 'inactive',
        name: 'Old',
        duration_days: 1,
        coin_cost: 1,
        discount_percent: 0,
        is_active: false,
      },
    ];
    memberships = [];
    coinTransactions = [];
    coinBalance = 2000;
  });

  it('lists only active plans', async () => {
    const res = await request(app)
      .get('/memberships/plans')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('subscribes: spends coins and records the membership', async () => {
    const res = await request(app)
      .post(`/memberships/plans/${PLAN_ID}/subscribe`)
      .set('Authorization', `Bearer ${await token()}`);

    expect(res.status).toBe(201);
    expect(res.body.coin_balance).toBe(500);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ player_id: PLAYER_ID, plan_id: PLAN_ID });
    expect(coinTransactions[0]).toMatchObject({ reason: 'MEMBERSHIP_PURCHASE', amount: 1500 });
  });

  it('rejects when the player cannot afford the plan', async () => {
    coinBalance = 100;
    const res = await request(app)
      .post(`/memberships/plans/${PLAN_ID}/subscribe`)
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(409);
    expect(memberships).toHaveLength(0);
  });

  it('404s an unknown or inactive plan', async () => {
    const res = await request(app)
      .post('/memberships/plans/inactive/subscribe')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(404);
  });

  it('returns null for /mine without a membership, the active one otherwise', async () => {
    const auth = `Bearer ${await token()}`;
    const none = await request(app).get('/memberships/mine').set('Authorization', auth);
    expect(none.status).toBe(200);
    expect(none.body.membership).toBeNull();

    memberships.push({
      membership_id: 'm1',
      player_id: PLAYER_ID,
      plan_id: PLAN_ID,
      started_at: new Date(),
      expires_at: new Date(Date.now() + 5 * DAY),
    });
    const active = await request(app).get('/memberships/mine').set('Authorization', auth);
    expect(active.body.membership.plan_name).toBe('Monthly Member');
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/memberships/plans')).status).toBe(401);
  });
});
