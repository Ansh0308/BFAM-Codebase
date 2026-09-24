import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Long tail — XP & Player Levels (PRD §12.35). players.xp_total is the
// cached running total (same pattern as players.coin_balance —
// coinsService.ts), xp_transactions is the append-only ledger it's
// derived from. XP only ever accumulates — the PRD never mentions
// spending it (unlike coins), so there's no "spend" counterpart here.

export type XpReason = 'REVIEW_REWARD' | 'ADMIN_ADJUSTMENT';

// Level thresholds: PRD §12.35 names the levels ("Newbie, Rookie, Player,
// Pro, Elite, Legend") but specifies no XP amounts for them. MVP defaults,
// documented here rather than hidden — same "no prior product decision"
// pattern as reviewService.ts's COIN_REWARD_PER_REVIEW. Tune freely; every
// player's level is computed from this table at read time, never stored,
// so changing it re-levels every player immediately and consistently.
export const LEVEL_THRESHOLDS = [
  { level: 'Newbie', minXp: 0 },
  { level: 'Rookie', minXp: 100 },
  { level: 'Player', minXp: 300 },
  { level: 'Pro', minXp: 700 },
  { level: 'Elite', minXp: 1500 },
  { level: 'Legend', minXp: 3000 },
] as const;
export type PlayerLevel = (typeof LEVEL_THRESHOLDS)[number]['level'];

export interface LevelProgress {
  xp_total: number;
  level: PlayerLevel;
  xp_into_level: number;
  xp_for_next_level: number | null;
  next_level: PlayerLevel | null;
  progress_percent: number;
}

// Pure so it's trivially testable without a database — same reasoning as
// statisticsService.ts's summarizeStatRows / leaderboardService.ts's
// aggregateByPlayer.
export function computeLevelProgress(xpTotal: number): LevelProgress {
  let currentIndex = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xpTotal >= LEVEL_THRESHOLDS[i].minXp) currentIndex = i;
  }
  const current = LEVEL_THRESHOLDS[currentIndex];
  const next = LEVEL_THRESHOLDS[currentIndex + 1] ?? null;

  const xpIntoLevel = xpTotal - current.minXp;
  const xpForNextLevel = next ? next.minXp - current.minXp : null;
  const progressPercent =
    next && xpForNextLevel ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;

  return {
    xp_total: xpTotal,
    level: current.level,
    xp_into_level: xpIntoLevel,
    xp_for_next_level: xpForNextLevel,
    next_level: next?.level ?? null,
    progress_percent: progressPercent,
  };
}

export async function getXpTotal(playerId: string, transaction?: unknown): Promise<number> {
  const [player] = await sequelize.query<{ xp_total: number }>(
    'SELECT xp_total FROM players WHERE player_id = :playerId',
    { type: QueryTypes.SELECT, replacements: { playerId }, transaction: transaction as never },
  );
  return player ? Number(player.xp_total) : 0;
}

export async function getPlayerLevelProgress(playerId: string): Promise<LevelProgress> {
  return computeLevelProgress(await getXpTotal(playerId));
}

export async function earnXp(
  playerId: string,
  amount: number,
  reason: XpReason,
  relatedEntity: { type: string; id: string } | null,
  transaction: unknown,
): Promise<number> {
  const currentTotal = await getXpTotal(playerId, transaction);
  const resultingTotal = currentTotal + amount;

  await sequelize.getQueryInterface().bulkInsert(
    'xp_transactions',
    [
      {
        xp_transaction_id: randomUUID(),
        player_id: playerId,
        reason,
        amount,
        resulting_total: resultingTotal,
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
      { xp_total: resultingTotal },
      { player_id: playerId },
      { transaction: transaction as never },
    );

  return resultingTotal;
}

export interface XpTransactionRow {
  xp_transaction_id: string;
  reason: XpReason;
  amount: number;
  resulting_total: number;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: Date;
}

export async function getXpHistory(playerId: string): Promise<XpTransactionRow[]> {
  return sequelize.query<XpTransactionRow>(
    `SELECT xp_transaction_id, reason, amount, resulting_total, related_entity_type,
            related_entity_id, created_at
     FROM xp_transactions
     WHERE player_id = :playerId
     ORDER BY created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
}
