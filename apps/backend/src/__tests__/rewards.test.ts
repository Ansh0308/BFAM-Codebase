// Long tail — Rewards catalog (PRD §12.36): service + routes. Only
// `sequelize` is faked.

const USER_ID = 'aaaaaaaa-0000-4000-8000-002201';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-002202';
const REWARD_ID = 'cccccccc-0000-4000-8000-002203';

let rewards: Array<Record<string, unknown>>;
let redemptions: Array<Record<string, unknown>>;
let coinBalance: number;
let coinTransactions: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('SELECT player_id FROM players WHERE user_id')) {
        return r.userId === USER_ID ? [{ player_id: PLAYER_ID }] : [];
      }
      if (sql.includes('FROM rewards') && sql.includes('reward_id = :rewardId')) {
        return rewards.filter((x) => x.reward_id === r.rewardId && x.is_active);
      }
      if (sql.includes('FROM rewards') && sql.includes('is_active = TRUE')) {
        return rewards.filter((x) => x.is_active);
      }
      if (sql.includes('SELECT coin_balance FROM players')) {
        return [{ coin_balance: coinBalance }];
      }
      if (sql.includes('FROM reward_redemptions rr')) {
        return redemptions.map((x) => ({ ...x, reward_name: 'Priority Booking Pass' }));
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
        if (table === 'reward_redemptions') redemptions.push(...rows);
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

async function token() {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: USER_ID });
  return res.body.token as string;
}

describe('Rewards catalog (long tail — PRD §12.36)', () => {
  beforeEach(() => {
    rewards = [
      {
        reward_id: REWARD_ID,
        name: 'Priority Booking Pass',
        description: null,
        coin_cost: 500,
        is_active: true,
      },
      { reward_id: 'inactive', name: 'Old', description: null, coin_cost: 1, is_active: false },
    ];
    redemptions = [];
    coinTransactions = [];
    coinBalance = 600;
  });

  it('lists only active rewards', async () => {
    const res = await request(app)
      .get('/rewards')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].name).toBe('Priority Booking Pass');
  });

  it('redeems a reward: spends coins and records a PENDING redemption', async () => {
    const res = await request(app)
      .post(`/rewards/${REWARD_ID}/redeem`)
      .set('Authorization', `Bearer ${await token()}`);

    expect(res.status).toBe(201);
    expect(res.body.coin_balance).toBe(100);
    expect(coinBalance).toBe(100);
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0]).toMatchObject({ coins_spent: 500, status: 'PENDING' });
    expect(coinTransactions[0]).toMatchObject({ reason: 'REWARD_REDEMPTION', amount: 500 });
  });

  it('rejects a redemption the player cannot afford, without recording anything', async () => {
    coinBalance = 100;
    const res = await request(app)
      .post(`/rewards/${REWARD_ID}/redeem`)
      .set('Authorization', `Bearer ${await token()}`);

    expect(res.status).toBe(409);
    expect(redemptions).toHaveLength(0);
    expect(coinBalance).toBe(100);
  });

  it('404s an unknown or inactive reward', async () => {
    const res = await request(app)
      .post('/rewards/inactive/redeem')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(404);
  });

  it('lists my redemptions', async () => {
    redemptions.push({
      redemption_id: 'x',
      coins_spent: 500,
      status: 'PENDING',
      created_at: new Date(),
    });
    const res = await request(app)
      .get('/rewards/redemptions/mine')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.body.results[0].reward_name).toBe('Priority Booking Pass');
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/rewards')).status).toBe(401);
  });
});
