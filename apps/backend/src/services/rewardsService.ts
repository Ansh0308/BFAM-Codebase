import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { RewardNotFoundError } from '../domain/errors';
import { spendCoins } from './coinsService';

// Long tail — Rewards catalog (PRD §12.36). See the migration's comment
// for scoping (coin-priced catalog, manual fulfilment).
export interface RewardRow {
  reward_id: string;
  name: string;
  description: string | null;
  coin_cost: number;
}

export async function listActiveRewards(): Promise<RewardRow[]> {
  return sequelize.query<RewardRow>(
    `SELECT reward_id, name, description, coin_cost FROM rewards
     WHERE is_active = TRUE ORDER BY coin_cost ASC`,
    { type: QueryTypes.SELECT },
  );
}

// Spends the reward's coin cost and records the redemption in one
// transaction, so coins are never taken without a redemption row or vice
// versa. Throws InsufficientCoinBalanceError (via spendCoins) if the
// player can't afford it.
export async function redeemReward(playerId: string, rewardId: string) {
  const [reward] = await sequelize.query<RewardRow>(
    `SELECT reward_id, name, description, coin_cost FROM rewards
     WHERE reward_id = :rewardId AND is_active = TRUE`,
    { type: QueryTypes.SELECT, replacements: { rewardId } },
  );
  if (!reward) throw new RewardNotFoundError(rewardId);

  const redemptionId = randomUUID();
  let coinBalance = 0;
  await sequelize.transaction(async (transaction) => {
    coinBalance = await spendCoins(
      playerId,
      reward.coin_cost,
      'REWARD_REDEMPTION',
      { type: 'reward_redemption', id: redemptionId },
      transaction,
    );
    await sequelize.getQueryInterface().bulkInsert(
      'reward_redemptions',
      [
        {
          redemption_id: redemptionId,
          reward_id: reward.reward_id,
          player_id: playerId,
          coins_spent: reward.coin_cost,
          status: 'PENDING',
          created_at: new Date(),
        },
      ],
      { transaction },
    );
  });

  return { redemption_id: redemptionId, reward_name: reward.name, coin_balance: coinBalance };
}

export interface RedemptionRow {
  redemption_id: string;
  reward_name: string;
  coins_spent: number;
  status: 'PENDING' | 'FULFILLED';
  created_at: Date;
}

export async function listMyRedemptions(playerId: string): Promise<RedemptionRow[]> {
  return sequelize.query<RedemptionRow>(
    `SELECT rr.redemption_id, r.name AS reward_name, rr.coins_spent, rr.status, rr.created_at
     FROM reward_redemptions rr
     JOIN rewards r ON r.reward_id = rr.reward_id
     WHERE rr.player_id = :playerId
     ORDER BY rr.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
}
