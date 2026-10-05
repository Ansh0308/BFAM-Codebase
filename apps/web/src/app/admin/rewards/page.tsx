'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Gift, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AdminMembershipPlan, AdminRedemption, AdminReward } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { Toggle } from '../../../components/ui/Toggle';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
} from '../../../components/ui/kit';

type Tab = 'rewards' | 'redemptions' | 'plans';

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Rewards & membership configuration (AW-8, PRD §9.1): the catalog players spend
// coins on, the redemptions waiting to be handed over, and the membership plans.
export default function AdminRewardsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('rewards');
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [plans, setPlans] = useState<AdminMembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editReward, setEditReward] = useState<AdminReward | 'new' | null>(null);
  const [editPlan, setEditPlan] = useState<AdminMembershipPlan | 'new' | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: 'reward' | 'plan';
    id: string;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, x, p] = await Promise.all([
        apiClient.getAdminRewards(),
        apiClient.getAdminRedemptions(),
        apiClient.getAdminMembershipPlans(),
      ]);
      setRewards(r.results);
      setRedemptions(x.results);
      setPlans(p.results);
    } catch {
      setRewards([]);
      setRedemptions([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (err: unknown, fallback: string) =>
    toast.error(err instanceof BFAMApiError ? err.message : fallback);

  async function fulfil(x: AdminRedemption) {
    try {
      await apiClient.fulfilAdminRedemption(x.redemption_id);
      toast.success(`${x.reward_name} marked as handed over`);
      await load();
    } catch (err) {
      fail(err, 'Could not update that redemption.');
    }
  }

  async function setActive(kind: 'reward' | 'plan', id: string, next: boolean) {
    try {
      if (kind === 'reward') await apiClient.updateAdminReward(id, { is_active: next });
      else await apiClient.updateAdminMembershipPlan(id, { is_active: next });
      await load();
    } catch (err) {
      fail(err, 'Could not change that.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      if (deleting.kind === 'reward') await apiClient.deleteAdminReward(deleting.id);
      else await apiClient.deleteAdminMembershipPlan(deleting.id);
      toast.success(`${deleting.name} was deleted`);
      await load();
    } catch (err) {
      fail(err, 'Could not delete that.');
    } finally {
      setDeleting(null);
    }
  }

  const pending = redemptions.filter((x) => x.status === 'PENDING');

  return (
    <div data-testid="admin-rewards-page">
      <PageHeader
        title="Rewards"
        subtitle="What players can spend BFAM Coins on."
        action={
          tab === 'rewards' ? (
            <Button icon={Plus} onClick={() => setEditReward('new')} testID="new-reward">
              New reward
            </Button>
          ) : tab === 'plans' ? (
            <Button icon={Plus} onClick={() => setEditPlan('new')} testID="new-plan">
              New plan
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <SegmentedControl<Tab>
          testIDPrefix="rewards-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'rewards', label: 'Rewards', count: rewards.length },
            { value: 'redemptions', label: 'To hand over', count: pending.length },
            { value: 'plans', label: 'Membership plans', count: plans.length },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : tab === 'rewards' ? (
        rewards.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No rewards"
            message="Add a reward players can redeem with coins."
            testID="rewards-empty"
          />
        ) : (
          <ul className="space-y-3" data-testid="reward-list">
            {rewards.map((r) => (
              <li
                key={r.reward_id}
                data-testid={`reward-${r.reward_id}`}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
              >
                <div className="min-w-[220px] flex-1">
                  <p className="font-ui text-card-title font-bold text-ink-black">{r.name}</p>
                  {r.description && (
                    <p className="font-ui text-body text-text-tertiary">{r.description}</p>
                  )}
                  <p className="font-ui text-micro text-text-tertiary mt-1">
                    {r.redemptions} redeemed
                  </p>
                </div>
                <p className="font-display text-[26px] text-brand-red">
                  {r.coin_cost.toLocaleString('en-IN')} coins
                </p>
                <Toggle
                  checked={r.is_active}
                  onChange={(v) => setActive('reward', r.reward_id, v)}
                  label={`${r.name} available`}
                  testID={`reward-toggle-${r.reward_id}`}
                />
                <Button
                  size="sm"
                  variant="soft"
                  icon={Pencil}
                  onClick={() => setEditReward(r)}
                  testID={`edit-reward-${r.reward_id}`}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  ariaLabel={`Delete ${r.name}`}
                  onClick={() => setDeleting({ kind: 'reward', id: r.reward_id, name: r.name })}
                  testID={`delete-reward-${r.reward_id}`}
                />
              </li>
            ))}
          </ul>
        )
      ) : tab === 'redemptions' ? (
        redemptions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nothing to hand over"
            message="Redemptions appear here when players spend coins."
            testID="redemptions-empty"
          />
        ) : (
          <ul className="space-y-3" data-testid="redemption-list">
            {redemptions.map((x) => (
              <li
                key={x.redemption_id}
                data-testid={`redemption-${x.redemption_id}`}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
              >
                <div className="min-w-[220px] flex-1">
                  <p className="font-ui text-card-title font-bold text-ink-black">
                    {x.reward_name}
                  </p>
                  <p className="font-ui text-body text-text-tertiary">
                    {x.player_name ?? x.player_phone} · {x.player_phone}
                    {x.bfam_id ? ` · ${x.bfam_id}` : ''} · {when(x.created_at)}
                  </p>
                </div>
                <p className="font-ui text-body text-text-secondary">{x.coins_spent} coins</p>
                {x.status === 'PENDING' ? (
                  <Button
                    size="sm"
                    icon={Check}
                    onClick={() => fulfil(x)}
                    testID={`fulfil-${x.redemption_id}`}
                  >
                    Mark handed over
                  </Button>
                ) : (
                  <StatusPill label="Handed over" tone="success" />
                )}
              </li>
            ))}
          </ul>
        )
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No membership plans"
          message="Add a plan players can buy with coins."
          testID="plans-empty"
        />
      ) : (
        <ul className="space-y-3" data-testid="plan-list">
          {plans.map((p) => (
            <li
              key={p.plan_id}
              data-testid={`plan-${p.plan_id}`}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4"
            >
              <div className="min-w-[220px] flex-1">
                <p className="font-ui text-card-title font-bold text-ink-black">{p.name}</p>
                <p className="font-ui text-body text-text-tertiary">
                  {p.duration_days} days · {p.discount_percent}% member discount ·{' '}
                  {p.active_members} active member{p.active_members === 1 ? '' : 's'}
                </p>
              </div>
              <p className="font-display text-[26px] text-brand-red">
                {p.coin_cost.toLocaleString('en-IN')} coins
              </p>
              <Toggle
                checked={p.is_active}
                onChange={(v) => setActive('plan', p.plan_id, v)}
                label={`${p.name} available`}
                testID={`plan-toggle-${p.plan_id}`}
              />
              <Button
                size="sm"
                variant="soft"
                icon={Pencil}
                onClick={() => setEditPlan(p)}
                testID={`edit-plan-${p.plan_id}`}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                ariaLabel={`Delete ${p.name}`}
                onClick={() => setDeleting({ kind: 'plan', id: p.plan_id, name: p.name })}
                testID={`delete-plan-${p.plan_id}`}
              />
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={editReward !== null}
        onClose={() => setEditReward(null)}
        title={editReward === 'new' ? 'New reward' : 'Edit reward'}
        testID="reward-drawer"
      >
        {editReward !== null && (
          <RewardForm
            reward={editReward === 'new' ? null : editReward}
            onSaved={async () => {
              toast.success('Reward saved');
              setEditReward(null);
              await load();
            }}
          />
        )}
      </Drawer>
      <Drawer
        open={editPlan !== null}
        onClose={() => setEditPlan(null)}
        title={editPlan === 'new' ? 'New plan' : 'Edit plan'}
        testID="plan-drawer"
      >
        {editPlan !== null && (
          <PlanForm
            plan={editPlan === 'new' ? null : editPlan}
            onSaved={async () => {
              toast.success('Plan saved');
              setEditPlan(null);
              await load();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete this ${deleting?.kind ?? 'item'}?`}
        message={
          deleting
            ? `${deleting.name} is removed. If players have used it, switch it off instead.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="rewards-delete-dialog"
      />
    </div>
  );
}

function RewardForm({
  reward,
  onSaved,
}: {
  reward: AdminReward | null;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(reward?.name ?? '');
  const [description, setDescription] = useState(reward?.description ?? '');
  const [cost, setCost] = useState(reward ? String(reward.coin_cost) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (name.trim().length < 2) return setError('Give the reward a name.');
    if (!(Number(cost) >= 1)) return setError('Set a coin cost of at least 1.');
    setError(null);
    setSaving(true);
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      coin_cost: Number(cost),
    };
    try {
      if (reward) await apiClient.updateAdminReward(reward.reward_id, body);
      else await apiClient.createAdminReward(body);
      await onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the reward.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="reward-form"
    >
      <label className="mb-4 block">
        <span className={LABEL}>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="reward-name"
          className={FIELD}
        />
      </label>
      <label className="mb-4 block">
        <span className={LABEL}>Description (optional)</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="reward-description"
          className={FIELD}
        />
      </label>
      <label className="mb-5 block">
        <span className={LABEL}>Coin cost</span>
        <input
          type="number"
          min="1"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          data-testid="reward-cost"
          className={FIELD}
        />
      </label>
      {error && (
        <p
          role="alert"
          data-testid="reward-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="reward-submit">
        {reward ? 'Save changes' : 'Add reward'}
      </Button>
    </form>
  );
}

function PlanForm({
  plan,
  onSaved,
}: {
  plan: AdminMembershipPlan | null;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(plan?.name ?? '');
  const [days, setDays] = useState(plan ? String(plan.duration_days) : '30');
  const [cost, setCost] = useState(plan ? String(plan.coin_cost) : '');
  const [discount, setDiscount] = useState(plan ? String(plan.discount_percent) : '10');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (name.trim().length < 2) return setError('Give the plan a name.');
    if (!(Number(days) >= 1)) return setError('Duration must be at least 1 day.');
    if (!(Number(cost) >= 1)) return setError('Set a coin cost of at least 1.');
    if (!(Number(discount) >= 0 && Number(discount) <= 100))
      return setError('Discount must be between 0 and 100.');
    setError(null);
    setSaving(true);
    const body = {
      name: name.trim(),
      duration_days: Number(days),
      coin_cost: Number(cost),
      discount_percent: Number(discount),
    };
    try {
      if (plan) await apiClient.updateAdminMembershipPlan(plan.plan_id, body);
      else await apiClient.createAdminMembershipPlan(body);
      await onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="plan-form"
    >
      <label className="mb-4 block">
        <span className={LABEL}>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="plan-name"
          className={FIELD}
        />
      </label>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <label className="block">
          <span className={LABEL}>Days</span>
          <input
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            data-testid="plan-days"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Coin cost</span>
          <input
            type="number"
            min="1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            data-testid="plan-cost"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Discount %</span>
          <input
            type="number"
            min="0"
            max="100"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            data-testid="plan-discount"
            className={FIELD}
          />
        </label>
      </div>
      {error && (
        <p
          role="alert"
          data-testid="plan-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="plan-submit">
        {plan ? 'Save changes' : 'Add plan'}
      </Button>
    </form>
  );
}
