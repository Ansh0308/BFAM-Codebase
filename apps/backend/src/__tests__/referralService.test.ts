// Unit tests for referralService.ts (long tail — Referral System, PRD
// §12.53). Only `sequelize` is faked.

interface PlayerRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
}
interface ReferralRow {
  referral_id: string;
  referrer_player_id: string;
  referred_player_id: string;
  status: 'PENDING' | 'QUALIFIED';
  reward_coins: number | null;
  created_at: Date;
  qualified_at: Date | null;
}
interface CoinTxRow {
  coin_transaction_id: string;
  player_id: string;
  reason: string;
  amount: number;
  balance_after: number;
}

const REFERRER_ID = 'aaaaaaaa-0000-4000-8000-002001';
const REFERRED_ID = 'bbbbbbbb-0000-4000-8000-002002';

let players: PlayerRow[];
let referrals: ReferralRow[];
let coinTransactions: CoinTxRow[];
let playerCoinBalances: Record<string, number>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('SELECT player_id FROM players WHERE bfam_id')) {
          const p = players.find((x) => x.bfam_id === r.bfamId);
          return p ? [{ player_id: p.player_id }] : [];
        }
        if (sql.includes('SELECT coin_balance FROM players WHERE player_id')) {
          return [{ coin_balance: playerCoinBalances[r.playerId as string] ?? 0 }];
        }
        if (sql.includes('SELECT referral_id, referrer_player_id FROM referrals')) {
          const referral = referrals.find(
            (x) => x.referred_player_id === r.referredPlayerId && x.status === 'PENDING',
          );
          return referral
            ? [
                {
                  referral_id: referral.referral_id,
                  referrer_player_id: referral.referrer_player_id,
                },
              ]
            : [];
        }
        if (sql.includes('FROM referrals r') && sql.includes('JOIN players p')) {
          return referrals
            .filter((x) => x.referrer_player_id === r.referrerPlayerId)
            .map((x) => {
              const referred = players.find((p) => p.player_id === x.referred_player_id)!;
              return {
                referral_id: x.referral_id,
                referred_player_id: x.referred_player_id,
                referred_bfam_id: referred.bfam_id,
                referred_full_name: referred.full_name,
                status: x.status,
                reward_coins: x.reward_coins,
                created_at: x.created_at,
                qualified_at: x.qualified_at,
              };
            });
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'referrals') referrals.push(...(rows as unknown as ReferralRow[]));
          if (table === 'coin_transactions')
            coinTransactions.push(...(rows as unknown as CoinTxRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'referrals') {
            const referral = referrals.find((x) => x.referral_id === where.referral_id);
            if (referral) Object.assign(referral, values);
          }
          if (table === 'players') {
            const playerId = where.player_id as string;
            if ('coin_balance' in values) {
              playerCoinBalances[playerId] = values.coin_balance as number;
            }
          }
        },
      }),
    },
  };
});

import {
  recordReferralIfValid,
  qualifyReferralIfPending,
  listMyReferrals,
  REFERRAL_REWARD_COINS,
} from '../services/referralService';

describe('referralService (long tail — Referral System)', () => {
  beforeEach(() => {
    players = [
      { player_id: REFERRER_ID, bfam_id: 'BF1001', full_name: 'Asha Patel' },
      { player_id: REFERRED_ID, bfam_id: 'BF1002', full_name: 'Rohan Mehta' },
    ];
    referrals = [];
    coinTransactions = [];
    playerCoinBalances = {};
  });

  describe('recordReferralIfValid', () => {
    it('creates a PENDING referral for a valid referral code', async () => {
      await recordReferralIfValid('BF1001', REFERRED_ID, undefined);

      expect(referrals).toHaveLength(1);
      expect(referrals[0]).toMatchObject({
        referrer_player_id: REFERRER_ID,
        referred_player_id: REFERRED_ID,
        status: 'PENDING',
      });
    });

    it('does nothing for an unknown referral code', async () => {
      await recordReferralIfValid('BF9999', REFERRED_ID, undefined);
      expect(referrals).toHaveLength(0);
    });

    it('does nothing for a self-referral', async () => {
      await recordReferralIfValid('BF1002', REFERRED_ID, undefined);
      expect(referrals).toHaveLength(0);
    });
  });

  describe('qualifyReferralIfPending', () => {
    beforeEach(() => {
      referrals = [
        {
          referral_id: 'ref-1',
          referrer_player_id: REFERRER_ID,
          referred_player_id: REFERRED_ID,
          status: 'PENDING',
          reward_coins: null,
          created_at: new Date(),
          qualified_at: null,
        },
      ];
    });

    it('marks a pending referral QUALIFIED and awards coins to the referrer', async () => {
      await qualifyReferralIfPending(REFERRED_ID, undefined);

      expect(referrals[0].status).toBe('QUALIFIED');
      expect(referrals[0].reward_coins).toBe(REFERRAL_REWARD_COINS);
      expect(referrals[0].qualified_at).not.toBeNull();
      expect(playerCoinBalances[REFERRER_ID]).toBe(REFERRAL_REWARD_COINS);
      expect(coinTransactions).toHaveLength(1);
      expect(coinTransactions[0]).toMatchObject({
        player_id: REFERRER_ID,
        reason: 'REFERRAL_REWARD',
        amount: REFERRAL_REWARD_COINS,
      });
    });

    it('does nothing for a player with no pending referral', async () => {
      await qualifyReferralIfPending('some-other-player', undefined);
      expect(referrals[0].status).toBe('PENDING');
      expect(coinTransactions).toHaveLength(0);
    });

    it('is idempotent — re-running after qualification never double-rewards', async () => {
      await qualifyReferralIfPending(REFERRED_ID, undefined);
      await qualifyReferralIfPending(REFERRED_ID, undefined);

      expect(coinTransactions).toHaveLength(1);
      expect(playerCoinBalances[REFERRER_ID]).toBe(REFERRAL_REWARD_COINS);
    });
  });

  describe('listMyReferrals', () => {
    it("returns every referral the caller made, with the referred player's name/bfam_id", async () => {
      referrals = [
        {
          referral_id: 'ref-1',
          referrer_player_id: REFERRER_ID,
          referred_player_id: REFERRED_ID,
          status: 'QUALIFIED',
          reward_coins: REFERRAL_REWARD_COINS,
          created_at: new Date(),
          qualified_at: new Date(),
        },
      ];

      const results = await listMyReferrals(REFERRER_ID);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        referred_bfam_id: 'BF1002',
        referred_full_name: 'Rohan Mehta',
        status: 'QUALIFIED',
      });
    });
  });
});
