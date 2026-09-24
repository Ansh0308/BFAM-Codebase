import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { earnCoins } from './coinsService';

// Long tail — Referral System (PRD §12.53/§31.35). See the migration's
// comment for the scoping decisions (referral code = BFAM ID, qualifying
// action = first completed match, one referral per referred player).
export const REFERRAL_REWARD_COINS = 100;

// Records a pending referral at signup — called from accountService.ts's
// createUserAccount, inside the same transaction as the new player row,
// so a referral is never recorded for a player that doesn't end up
// existing. Silently does nothing for an invalid/unknown code or a
// self-referral (impossible in practice — a brand-new player can't yet
// know their own not-yet-allocated BFAM ID — but checked anyway for
// safety) rather than blocking registration: a bad referral code is not
// the new player's fault, and worth surfacing them a "referral failed"
// error message would defeat the whole point of receiving it in a
// simple "here's a code" invite message.
export async function recordReferralIfValid(
  referralCode: string,
  referredPlayerId: string,
  transaction: unknown,
): Promise<void> {
  const [referrer] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE bfam_id = :bfamId',
    {
      type: QueryTypes.SELECT,
      replacements: { bfamId: referralCode },
      transaction: transaction as never,
    },
  );
  if (!referrer || referrer.player_id === referredPlayerId) return;

  await sequelize.getQueryInterface().bulkInsert(
    'referrals',
    [
      {
        referral_id: randomUUID(),
        referrer_player_id: referrer.player_id,
        referred_player_id: referredPlayerId,
        status: 'PENDING',
        reward_coins: null,
        created_at: new Date(),
        qualified_at: null,
      },
    ],
    { transaction: transaction as never },
  );
}

interface PendingReferralRow {
  referral_id: string;
  referrer_player_id: string;
}

// Called from statisticsService.ts's materializeMatchStatistics for every
// player on a just-completed match's confirmed roster — the first time a
// referred player appears here is necessarily their first completed
// match, since their referral row (if any) was created at signup, before
// they could have played anything. Idempotent by construction: only a
// PENDING referral is ever matched, so a re-run (e.g. the manual
// re-materialize endpoint) never double-rewards.
export async function qualifyReferralIfPending(
  referredPlayerId: string,
  transaction: unknown,
): Promise<void> {
  const [referral] = await sequelize.query<PendingReferralRow>(
    `SELECT referral_id, referrer_player_id FROM referrals
     WHERE referred_player_id = :referredPlayerId AND status = 'PENDING'`,
    {
      type: QueryTypes.SELECT,
      replacements: { referredPlayerId },
      transaction: transaction as never,
    },
  );
  if (!referral) return;

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'referrals',
      { status: 'QUALIFIED', reward_coins: REFERRAL_REWARD_COINS, qualified_at: new Date() },
      { referral_id: referral.referral_id },
      { transaction: transaction as never },
    );

  await earnCoins(
    referral.referrer_player_id,
    REFERRAL_REWARD_COINS,
    'REFERRAL_REWARD',
    { type: 'referral', id: referral.referral_id },
    transaction,
  );
}

export interface ReferralRow {
  referral_id: string;
  referred_player_id: string;
  referred_bfam_id: string;
  referred_full_name: string | null;
  status: 'PENDING' | 'QUALIFIED';
  reward_coins: number | null;
  created_at: Date;
  qualified_at: Date | null;
}

export async function listMyReferrals(referrerPlayerId: string): Promise<ReferralRow[]> {
  return sequelize.query<ReferralRow>(
    `SELECT r.referral_id, r.referred_player_id, p.bfam_id AS referred_bfam_id,
            p.full_name AS referred_full_name, r.status, r.reward_coins,
            r.created_at, r.qualified_at
     FROM referrals r
     JOIN players p ON p.player_id = r.referred_player_id
     WHERE r.referrer_player_id = :referrerPlayerId
     ORDER BY r.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { referrerPlayerId } },
  );
}
