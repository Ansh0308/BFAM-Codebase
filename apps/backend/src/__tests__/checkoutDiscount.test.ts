// Integration tests for backlog B-1's checkout discount service: applying
// a promo code and/or BFAM Coins to a pending payment obligation. Only
// `sequelize` is faked — the real service runs unmodified.

interface ObligationRow {
  obligation_id: string;
  booking_id: string;
  player_id: string | null;
  amount_due: string;
  due_status: string;
}
interface PlayerRow {
  player_id: string;
  user_id: string;
  coin_balance: number;
}
interface PromoRow {
  promo_code_id: string;
  code: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: string;
  max_discount_amount: string | null;
  min_booking_amount: string;
  usage_limit_total: number | null;
  usage_limit_per_player: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000401';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-000000000402';
const OBLIGATION_ID = 'cccccccc-0000-4000-8000-000000000403';
const PROMO_ID = 'dddddddd-0000-4000-8000-000000000404';

let obligations: ObligationRow[];
let players: PlayerRow[];
let promoCodes: PromoRow[];
let redemptions: { promo_code_id: string; player_id: string }[];
const coinTransactions: Record<string, unknown>[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM payment_obligations WHERE obligation_id')) {
          const o = obligations.find((x) => x.obligation_id === r.obligationId);
          return o ? [o] : [];
        }
        if (sql.includes('FROM players WHERE user_id')) {
          const p = players.find((x) => x.user_id === r.userId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (sql.includes('SELECT coin_balance FROM players WHERE player_id')) {
          const p = players.find((x) => x.player_id === r.playerId);
          return p ? [{ coin_balance: p.coin_balance }] : [];
        }
        if (sql.includes('FROM promo_codes WHERE code')) {
          const p = promoCodes.find((x) => x.code === r.code);
          return p ? [p] : [];
        }
        if (sql.includes('FROM promo_code_redemptions WHERE promo_code_id = :id AND player_id')) {
          const count = redemptions.filter(
            (x) => x.promo_code_id === r.id && x.player_id === r.playerId,
          ).length;
          return [{ count }];
        }
        if (sql.includes('FROM promo_code_redemptions WHERE promo_code_id = :id')) {
          const count = redemptions.filter((x) => x.promo_code_id === r.id).length;
          return [{ count }];
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
          if (table === 'payment_obligations') {
            const o = obligations.find((x) => x.obligation_id === where.obligation_id);
            if (o) Object.assign(o, values);
          }
          if (table === 'players') {
            const p = players.find((x) => x.player_id === where.player_id);
            if (p) Object.assign(p, values);
          }
        },
        bulkInsert: async (table: string, rows: Record<string, unknown>[]) => {
          if (table === 'promo_code_redemptions') {
            redemptions.push(
              ...rows.map((row) => ({
                promo_code_id: row.promo_code_id as string,
                player_id: row.player_id as string,
              })),
            );
          }
          if (table === 'coin_transactions') coinTransactions.push(...rows);
        },
      }),
    },
  };
});

import { applyCheckoutDiscount } from '../services/checkoutService';

describe('applyCheckoutDiscount (backlog B-1)', () => {
  beforeEach(() => {
    obligations = [
      {
        obligation_id: OBLIGATION_ID,
        booking_id: 'booking-1',
        player_id: null,
        amount_due: '1000.00',
        due_status: 'PENDING',
      },
    ];
    players = [{ player_id: PLAYER_ID, user_id: USER_ID, coin_balance: 500 }];
    promoCodes = [
      {
        promo_code_id: PROMO_ID,
        code: 'SAVE10',
        discount_type: 'PERCENTAGE',
        discount_value: '10',
        max_discount_amount: null,
        min_booking_amount: '0',
        usage_limit_total: null,
        usage_limit_per_player: 1,
        valid_from: null,
        valid_until: null,
        is_active: true,
      },
    ];
    redemptions = [];
    coinTransactions.length = 0;
  });

  it('applies a percentage promo code to reduce the amount due', async () => {
    const result = await applyCheckoutDiscount(OBLIGATION_ID, USER_ID, { promoCode: 'save10' });

    expect(result.promo_discount).toBe(100);
    expect(result.new_amount_due).toBe(900);
    expect(obligations[0].amount_due).toBe(900);
  });

  it('applies coins on top of a promo code, in the same call', async () => {
    const result = await applyCheckoutDiscount(OBLIGATION_ID, USER_ID, {
      promoCode: 'SAVE10',
      coinsToRedeem: 200,
    });

    expect(result.promo_discount).toBe(100);
    expect(result.coins_spent).toBe(200);
    expect(result.new_amount_due).toBe(700);
    expect(players[0].coin_balance).toBe(300);
  });

  it('spends only as many coins as the player has', async () => {
    players[0].coin_balance = 50;
    const result = await applyCheckoutDiscount(OBLIGATION_ID, USER_ID, { coinsToRedeem: 500 });

    expect(result.coins_spent).toBe(50);
    expect(result.new_amount_due).toBe(950);
    expect(players[0].coin_balance).toBe(0);
  });

  it('floors the resulting amount at ₹1 rather than letting a discount fully zero it out', async () => {
    players[0].coin_balance = 2000;
    const result = await applyCheckoutDiscount(OBLIGATION_ID, USER_ID, {
      promoCode: 'SAVE10',
      coinsToRedeem: 2000,
    });

    expect(result.new_amount_due).toBe(1);
    expect(obligations[0].amount_due).toBe(1);
  });

  it('rejects a promo code that does not exist', async () => {
    await expect(
      applyCheckoutDiscount(OBLIGATION_ID, USER_ID, { promoCode: 'NOPE' }),
    ).rejects.toThrow('not found');
  });

  it('rejects reusing a promo code past its per-player usage limit', async () => {
    redemptions.push({ promo_code_id: PROMO_ID, player_id: PLAYER_ID });

    await expect(
      applyCheckoutDiscount(OBLIGATION_ID, USER_ID, { promoCode: 'SAVE10' }),
    ).rejects.toThrow(/already used/i);
  });

  it('rejects applying a discount to an already-paid obligation', async () => {
    obligations[0].due_status = 'PAID';

    await expect(
      applyCheckoutDiscount(OBLIGATION_ID, USER_ID, { coinsToRedeem: 10 }),
    ).rejects.toThrow(/already been paid/i);
  });
});
