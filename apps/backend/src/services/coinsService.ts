import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { InsufficientCoinBalanceError } from '../domain/errors';

// BFAM Coins ledger (backlog B-1/B-4): players.coin_balance is the cached
// "current value" (same pattern as players.skill_rating/reliability_score
// elsewhere in this codebase), coin_transactions is the append-only audit
// trail it's derived from. Every earn/spend goes through one of the two
// functions below so the two never drift apart.

export async function getCoinBalance(playerId: string, transaction?: unknown): Promise<number> {
  const [player] = await sequelize.query<{ coin_balance: number }>(
    'SELECT coin_balance FROM players WHERE player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { playerId }, transaction: transaction as never },
  );
  return player ? Number(player.coin_balance) : 0;
}

export type CoinReason =
  'REVIEW_REWARD' | 'BOOKING_REDEMPTION' | 'ADMIN_ADJUSTMENT' | 'REFERRAL_REWARD';

async function recordCoinTransaction(
  playerId: string,
  transactionType: 'EARN' | 'SPEND',
  reason: CoinReason,
  amount: number,
  relatedEntity: { type: string; id: string } | null,
  transaction: unknown,
): Promise<number> {
  const currentBalance = await getCoinBalance(playerId, transaction);
  const balanceAfter =
    transactionType === 'EARN' ? currentBalance + amount : currentBalance - amount;

  await sequelize.getQueryInterface().bulkInsert(
    'coin_transactions',
    [
      {
        coin_transaction_id: randomUUID(),
        player_id: playerId,
        transaction_type: transactionType,
        reason,
        amount,
        balance_after: balanceAfter,
        related_entity_type: relatedEntity?.type ?? null,
        related_entity_id: relatedEntity?.id ?? null,
        created_at: new Date(),
      },
    ],
    { transaction: transaction as never },
  );
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'players',
      { coin_balance: balanceAfter },
      { player_id: playerId },
      { transaction: transaction as never },
    );
  return balanceAfter;
}

export async function earnCoins(
  playerId: string,
  amount: number,
  reason: CoinReason,
  relatedEntity: { type: string; id: string } | null,
  transaction: unknown,
): Promise<number> {
  return recordCoinTransaction(playerId, 'EARN', reason, amount, relatedEntity, transaction);
}

// Throws InsufficientCoinBalanceError if the player doesn't have enough —
// callers should compute how many coins are actually affordable/useful
// (domain/checkout.ts's computeCoinRedemption) before calling this, so
// this should only ever fail on a genuine race (balance changed between
// the check and this call).
export async function spendCoins(
  playerId: string,
  amount: number,
  reason: CoinReason,
  relatedEntity: { type: string; id: string } | null,
  transaction: unknown,
): Promise<number> {
  if (amount === 0) return getCoinBalance(playerId, transaction);
  const currentBalance = await getCoinBalance(playerId, transaction);
  if (amount > currentBalance) throw new InsufficientCoinBalanceError();
  return recordCoinTransaction(playerId, 'SPEND', reason, amount, relatedEntity, transaction);
}
