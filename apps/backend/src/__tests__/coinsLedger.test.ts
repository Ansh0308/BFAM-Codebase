// Unit tests for the BFAM Coins ledger helpers (backlog B-1/B-4):
// players.coin_balance stays in sync with the append-only
// coin_transactions ledger, and spendCoins refuses to overdraw. Only
// `sequelize` is faked.

const PLAYER_ID = 'aaaaaaaa-0000-4000-8000-000000000601';

let player: { player_id: string; coin_balance: number };
const transactions: Record<string, unknown>[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT coin_balance FROM players WHERE player_id')) {
          return r.playerId === player.player_id ? [{ coin_balance: player.coin_balance }] : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'coin_transactions') transactions.push(...rows);
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'players' && where.player_id === player.player_id) {
            Object.assign(player, values);
          }
        },
      }),
    },
  };
});

import { earnCoins, getCoinBalance, spendCoins } from '../services/coinsService';

describe('BFAM Coins ledger (backlog B-1/B-4)', () => {
  beforeEach(() => {
    player = { player_id: PLAYER_ID, coin_balance: 100 };
    transactions.length = 0;
  });

  it('earnCoins increases the balance and records an EARN transaction', async () => {
    const newBalance = await earnCoins(
      PLAYER_ID,
      20,
      'REVIEW_REWARD',
      { type: 'review', id: 'r1' },
      undefined,
    );

    expect(newBalance).toBe(120);
    expect(player.coin_balance).toBe(120);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      transaction_type: 'EARN',
      reason: 'REVIEW_REWARD',
      amount: 20,
      balance_after: 120,
    });
  });

  it('spendCoins decreases the balance and records a SPEND transaction', async () => {
    const newBalance = await spendCoins(
      PLAYER_ID,
      40,
      'BOOKING_REDEMPTION',
      { type: 'payment_obligation', id: 'o1' },
      undefined,
    );

    expect(newBalance).toBe(60);
    expect(player.coin_balance).toBe(60);
    expect(transactions[0]).toMatchObject({ transaction_type: 'SPEND', amount: 40 });
  });

  it('spendCoins refuses to overdraw the balance', async () => {
    await expect(spendCoins(PLAYER_ID, 500, 'BOOKING_REDEMPTION', null, undefined)).rejects.toThrow(
      /enough BFAM Coins/i,
    );
    expect(player.coin_balance).toBe(100);
    expect(transactions).toHaveLength(0);
  });

  it('spendCoins of exactly zero is a no-op that records nothing', async () => {
    const balance = await spendCoins(PLAYER_ID, 0, 'BOOKING_REDEMPTION', null, undefined);
    expect(balance).toBe(100);
    expect(transactions).toHaveLength(0);
  });

  it('getCoinBalance returns 0 for an unknown player rather than throwing', async () => {
    expect(await getCoinBalance('unknown-player')).toBe(0);
  });
});
