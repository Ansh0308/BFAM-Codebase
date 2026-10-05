import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { writeAuditLog } from './auditLogService';
import { sendNotification } from './notificationService';

// Admin Web — Rewards and Membership configuration (AW-8, PRD §9.1): the
// catalog players spend coins on, the redemptions waiting to be fulfilled, and
// the membership plans. Until now these were edited straight in the database.

export class RewardsConfigError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'RewardsConfigError';
  }
}

const q = <T extends object>(sql: string, replacements: Record<string, unknown> = {}) =>
  sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements });

async function audit(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  data?: Record<string, unknown>,
) {
  await writeAuditLog({
    actorUserId: actorId,
    actorRole: 'ADMIN',
    action,
    resourceType,
    resourceId,
    afterData: data,
  });
}

// ---- Rewards --------------------------------------------------------------------

export interface RewardInput {
  name: string;
  description?: string | null;
  coin_cost: number;
  is_active?: boolean;
}

export interface RewardRow {
  reward_id: string;
  name: string;
  description: string | null;
  coin_cost: number;
  is_active: boolean | number;
  created_at: Date;
  redemptions: number | string;
}

export async function listRewards() {
  const rows = await q<RewardRow>(
    `SELECT r.reward_id, r.name, r.description, r.coin_cost, r.is_active, r.created_at,
            (SELECT COUNT(*) FROM reward_redemptions x WHERE x.reward_id = r.reward_id) AS redemptions
     FROM rewards r ORDER BY r.is_active DESC, r.coin_cost ASC`,
  );
  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active),
    redemptions: Number(r.redemptions),
  }));
}

export async function createReward(actorId: string, input: RewardInput) {
  const id = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('rewards', [
    {
      reward_id: id,
      name: input.name,
      description: input.description ?? null,
      coin_cost: input.coin_cost,
      is_active: input.is_active ?? true,
      created_at: new Date(),
    },
  ]);
  await audit(actorId, 'REWARD_CREATED', 'reward', id, {
    name: input.name,
    coin_cost: input.coin_cost,
  });
  return (await listRewards()).find((r) => r.reward_id === id);
}

async function assertReward(rewardId: string) {
  const [row] = await q<{ reward_id: string }>(
    'SELECT reward_id FROM rewards WHERE reward_id = :rewardId',
    { rewardId },
  );
  if (!row) throw new RewardsConfigError('Reward not found.', 404);
}

export async function updateReward(
  actorId: string,
  rewardId: string,
  changes: Partial<RewardInput>,
) {
  await assertReward(rewardId);
  const values: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'coin_cost', 'is_active'] as const) {
    if (changes[key] !== undefined) values[key] = changes[key];
  }
  if (Object.keys(values).length > 0) {
    await sequelize.getQueryInterface().bulkUpdate('rewards', values, { reward_id: rewardId });
    await audit(actorId, 'REWARD_UPDATED', 'reward', rewardId, values);
  }
  return (await listRewards()).find((r) => r.reward_id === rewardId);
}

export async function deleteReward(actorId: string, rewardId: string) {
  await assertReward(rewardId);
  const [row] = await q<{ n: number | string }>(
    'SELECT COUNT(*) AS n FROM reward_redemptions WHERE reward_id = :rewardId',
    { rewardId },
  );
  if (Number(row?.n ?? 0) > 0) {
    throw new RewardsConfigError(
      'Players have already redeemed this reward. Switch it off instead of deleting it.',
      409,
    );
  }
  await sequelize.getQueryInterface().bulkDelete('rewards', { reward_id: rewardId });
  await audit(actorId, 'REWARD_DELETED', 'reward', rewardId);
}

// ---- Redemptions to fulfil --------------------------------------------------------

export async function listRedemptions(status?: 'PENDING' | 'FULFILLED') {
  return q<Record<string, unknown>>(
    `SELECT x.redemption_id, x.status, x.coins_spent, x.created_at, r.name AS reward_name,
            pl.full_name AS player_name, pl.bfam_id, u.phone_number AS player_phone
     FROM reward_redemptions x
     JOIN rewards r ON r.reward_id = x.reward_id
     JOIN players pl ON pl.player_id = x.player_id
     JOIN users u ON u.user_id = pl.user_id
     ${status ? 'WHERE x.status = :status' : ''}
     ORDER BY x.status ASC, x.created_at DESC LIMIT 300`,
    status ? { status } : {},
  );
}

export async function fulfilRedemption(actorId: string, redemptionId: string) {
  const [row] = await q<{ status: string; user_id: string; reward_name: string }>(
    `SELECT x.status, pl.user_id, r.name AS reward_name FROM reward_redemptions x
     JOIN rewards r ON r.reward_id = x.reward_id JOIN players pl ON pl.player_id = x.player_id
     WHERE x.redemption_id = :redemptionId`,
    { redemptionId },
  );
  if (!row) throw new RewardsConfigError('Redemption not found.', 404);
  if (row.status === 'FULFILLED')
    throw new RewardsConfigError('That reward has already been handed over.', 409);
  await sequelize
    .getQueryInterface()
    .bulkUpdate('reward_redemptions', { status: 'FULFILLED' }, { redemption_id: redemptionId });
  await audit(actorId, 'REWARD_FULFILLED', 'reward_redemption', redemptionId);
  await sendNotification({
    userId: row.user_id,
    event: 'REWARD_RECEIVED',
    params: { rewardName: row.reward_name },
    relatedEntityType: 'reward',
    relatedEntityId: redemptionId,
  });
}

// ---- Membership plans -----------------------------------------------------------------

export interface PlanInput {
  name: string;
  duration_days: number;
  coin_cost: number;
  discount_percent: number;
  is_active?: boolean;
}

export interface PlanRow {
  plan_id: string;
  name: string;
  duration_days: number;
  coin_cost: number;
  discount_percent: number;
  is_active: boolean | number;
  created_at: Date;
  active_members: number | string;
  total_members: number | string;
}

export async function listPlans() {
  const rows = await q<PlanRow>(
    `SELECT m.plan_id, m.name, m.duration_days, m.coin_cost, m.discount_percent, m.is_active, m.created_at,
            (SELECT COUNT(*) FROM player_memberships pm
              WHERE pm.plan_id = m.plan_id AND pm.expires_at > UTC_TIMESTAMP()) AS active_members,
            (SELECT COUNT(*) FROM player_memberships pm WHERE pm.plan_id = m.plan_id) AS total_members
     FROM membership_plans m ORDER BY m.is_active DESC, m.duration_days ASC`,
  );
  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active),
    active_members: Number(r.active_members),
    total_members: Number(r.total_members),
  }));
}

async function assertPlan(planId: string) {
  const [row] = await q<{ plan_id: string }>(
    'SELECT plan_id FROM membership_plans WHERE plan_id = :planId',
    { planId },
  );
  if (!row) throw new RewardsConfigError('Plan not found.', 404);
}

export async function createPlan(actorId: string, input: PlanInput) {
  const id = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('membership_plans', [
    {
      plan_id: id,
      name: input.name,
      duration_days: input.duration_days,
      coin_cost: input.coin_cost,
      discount_percent: input.discount_percent,
      is_active: input.is_active ?? true,
      created_at: new Date(),
    },
  ]);
  await audit(actorId, 'MEMBERSHIP_PLAN_CREATED', 'membership_plan', id, { name: input.name });
  return (await listPlans()).find((p) => p.plan_id === id);
}

export async function updatePlan(actorId: string, planId: string, changes: Partial<PlanInput>) {
  await assertPlan(planId);
  const values: Record<string, unknown> = {};
  for (const key of [
    'name',
    'duration_days',
    'coin_cost',
    'discount_percent',
    'is_active',
  ] as const) {
    if (changes[key] !== undefined) values[key] = changes[key];
  }
  if (Object.keys(values).length > 0) {
    await sequelize.getQueryInterface().bulkUpdate('membership_plans', values, { plan_id: planId });
    await audit(actorId, 'MEMBERSHIP_PLAN_UPDATED', 'membership_plan', planId, values);
  }
  return (await listPlans()).find((p) => p.plan_id === planId);
}

export async function deletePlan(actorId: string, planId: string) {
  await assertPlan(planId);
  const [row] = await q<{ n: number | string }>(
    'SELECT COUNT(*) AS n FROM player_memberships WHERE plan_id = :planId',
    { planId },
  );
  if (Number(row?.n ?? 0) > 0) {
    throw new RewardsConfigError(
      'Players have held this plan. Switch it off instead of deleting it.',
      409,
    );
  }
  await sequelize.getQueryInterface().bulkDelete('membership_plans', { plan_id: planId });
  await audit(actorId, 'MEMBERSHIP_PLAN_DELETED', 'membership_plan', planId);
}
