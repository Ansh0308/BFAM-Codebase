import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { MembershipPlanNotFoundError } from '../domain/errors';
import { spendCoins } from './coinsService';

// Long tail — Memberships (PRD §12.51). See the migration's comment for the
// scoping decisions (coin-purchased, discount not yet applied at checkout,
// early renewal extends from current expiry).
const DAY_MS = 24 * 60 * 60 * 1000;

// Pure so the extend-vs-restart rule is unit-testable: a still-active
// membership extends from its current expiry; a lapsed/absent one starts now.
export function computeNewExpiry(
  now: Date,
  currentExpiry: Date | null,
  durationDays: number,
): { startsAt: Date; expiresAt: Date } {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return { startsAt: now, expiresAt: new Date(base.getTime() + durationDays * DAY_MS) };
}

export interface PlanRow {
  plan_id: string;
  name: string;
  duration_days: number;
  coin_cost: number;
  discount_percent: number;
}

export async function listActivePlans(): Promise<PlanRow[]> {
  return sequelize.query<PlanRow>(
    `SELECT plan_id, name, duration_days, coin_cost, discount_percent
     FROM membership_plans WHERE is_active = TRUE ORDER BY duration_days ASC`,
    { type: QueryTypes.SELECT },
  );
}

export interface MembershipRow {
  membership_id: string;
  plan_name: string;
  discount_percent: number;
  started_at: Date;
  expires_at: Date;
}

// The player's currently active membership (latest expiry still in the
// future), or null.
export async function getActiveMembership(
  playerId: string,
  now: Date = new Date(),
): Promise<MembershipRow | null> {
  const [row] = await sequelize.query<MembershipRow>(
    `SELECT pm.membership_id, mp.name AS plan_name, mp.discount_percent,
            pm.started_at, pm.expires_at
     FROM player_memberships pm
     JOIN membership_plans mp ON mp.plan_id = pm.plan_id
     WHERE pm.player_id = :playerId AND pm.expires_at > :now
     ORDER BY pm.expires_at DESC LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { playerId, now } },
  );
  return row ?? null;
}

export async function subscribeToPlan(playerId: string, planId: string) {
  const [plan] = await sequelize.query<PlanRow>(
    `SELECT plan_id, name, duration_days, coin_cost, discount_percent
     FROM membership_plans WHERE plan_id = :planId AND is_active = TRUE`,
    { type: QueryTypes.SELECT, replacements: { planId } },
  );
  if (!plan) throw new MembershipPlanNotFoundError(planId);

  const now = new Date();
  const current = await getActiveMembership(playerId, now);
  const { startsAt, expiresAt } = computeNewExpiry(
    now,
    current ? new Date(current.expires_at) : null,
    plan.duration_days,
  );

  const membershipId = randomUUID();
  let coinBalance = 0;
  await sequelize.transaction(async (transaction) => {
    coinBalance = await spendCoins(
      playerId,
      plan.coin_cost,
      'MEMBERSHIP_PURCHASE',
      { type: 'membership', id: membershipId },
      transaction,
    );
    await sequelize.getQueryInterface().bulkInsert(
      'player_memberships',
      [
        {
          membership_id: membershipId,
          player_id: playerId,
          plan_id: plan.plan_id,
          started_at: startsAt,
          expires_at: expiresAt,
          created_at: now,
        },
      ],
      { transaction },
    );
  });

  return {
    membership_id: membershipId,
    plan_name: plan.name,
    expires_at: expiresAt,
    coin_balance: coinBalance,
  };
}
