'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Plus, RefreshCw, Ticket, Trash2 } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  AdminPromoCode,
  CreatePromoCodeInput,
  UpdatePromoCodeInput,
} from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { formatRupees } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import { Toggle } from '../../../components/ui/Toggle';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SegmentedControl,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type Filter = 'all' | 'live' | 'off';
type PromoState = 'LIVE' | 'OFF' | 'SCHEDULED' | 'EXPIRED';

function stateOf(p: AdminPromoCode, now = new Date()): PromoState {
  if (!p.is_active) return 'OFF';
  if (p.valid_from && new Date(p.valid_from) > now) return 'SCHEDULED';
  if (p.valid_until && new Date(p.valid_until) < now) return 'EXPIRED';
  return 'LIVE';
}

const STATE_TONE: Record<PromoState, Tone> = {
  LIVE: 'success',
  OFF: 'neutral',
  SCHEDULED: 'info',
  EXPIRED: 'warning',
};

function offerLabel(p: AdminPromoCode): string {
  const value = Number(p.discount_value);
  if (p.discount_type === 'PERCENTAGE') {
    return `${value}% off${p.max_discount_amount ? ` (up to ${formatRupees(p.max_discount_amount)})` : ''}`;
  }
  return `${formatRupees(value)} off`;
}

function day(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

// Promo codes (PRD §9.1 "rewards configuration", backlog B-1). Create codes,
// see their rules at a glance, and switch them on or off without deleting
// anything that players already redeemed.
export default function AdminPromosPage() {
  const toast = useToast();
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPromoCode | null>(null);
  const [deleting, setDeleting] = useState<AdminPromoCode | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient.getPromoCodes();
      setPromos(res.results);
    } catch {
      setPromos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: promos.length,
      live: promos.filter((p) => stateOf(p) === 'LIVE').length,
      off: promos.filter((p) => !p.is_active).length,
    }),
    [promos],
  );
  const visible = promos.filter((p) =>
    filter === 'all' ? true : filter === 'live' ? stateOf(p) === 'LIVE' : !p.is_active,
  );

  async function toggle(p: AdminPromoCode, next: boolean) {
    setBusyId(p.promo_code_id);
    // Optimistic: flip it now, put it back if the server refuses.
    setPromos((prev) =>
      prev.map((x) => (x.promo_code_id === p.promo_code_id ? { ...x, is_active: next } : x)),
    );
    try {
      await apiClient.setPromoCodeActive(p.promo_code_id, next);
      toast.success(`${p.code} is now ${next ? 'on' : 'off'}`);
    } catch (err) {
      setPromos((prev) =>
        prev.map((x) =>
          x.promo_code_id === p.promo_code_id ? { ...x, is_active: p.is_active } : x,
        ),
      );
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not change that code.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiClient.deletePromoCode(deleting.promo_code_id);
      toast.success(`${deleting.code} was deleted`);
      setDeleting(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete that code.');
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div data-testid="admin-promos-page">
      <PageHeader
        title="Promo Codes"
        subtitle="Discounts players can apply at checkout."
        action={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => load(true)}
              testID="promos-refresh"
            >
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setCreating(true)} testID="new-promo">
              New code
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <SegmentedControl<Filter>
          testIDPrefix="promo-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'live', label: 'Live now', count: counts.live },
            { value: 'off', label: 'Switched off', count: counts.off },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No promo codes"
          message={
            promos.length === 0
              ? 'Create your first code to offer players a discount.'
              : 'No codes in this view.'
          }
          testID="promos-empty"
          action={
            promos.length === 0 ? (
              <Button icon={Plus} onClick={() => setCreating(true)}>
                New code
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="promo-list">
          {visible.map((p, index) => {
            const state = stateOf(p);
            return (
              <motion.li
                key={p.promo_code_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: EASE_OUT }}
                whileHover={{ y: -3 }}
                data-testid={`promo-${p.code}`}
                className={`relative overflow-hidden rounded-lg border bg-surface p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.09)] ${
                  state === 'LIVE' ? 'border-brand-red/30' : 'border-border-subtle'
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute -right-6 -top-6 h-[100px] w-[100px] rounded-[999px] ${
                    state === 'LIVE' ? 'bg-brand-red/10' : 'bg-ink-black/[0.04]'
                  }`}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-[34px] leading-none tracking-wider text-ink-black">
                      {p.code}
                    </p>
                    <p className="mt-2 font-ui text-card-title font-bold text-brand-red">
                      {offerLabel(p)}
                    </p>
                  </div>
                  <Toggle
                    checked={Boolean(p.is_active)}
                    onChange={(next) => toggle(p, next)}
                    label={`${p.code} active`}
                    disabled={busyId === p.promo_code_id}
                    testID={`toggle-${p.code}`}
                  />
                </div>
                <div className="relative mt-4 flex flex-wrap items-center gap-2">
                  <StatusPill tone={STATE_TONE[state]} label={state} pulse={state === 'LIVE'} />
                  {Number(p.min_booking_amount) > 0 && (
                    <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                      Min booking {formatRupees(p.min_booking_amount)}
                    </span>
                  )}
                  {p.usage_limit_total != null && (
                    <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                      {p.usage_limit_total} uses total
                    </span>
                  )}
                  {p.usage_limit_per_player != null && (
                    <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                      {p.usage_limit_per_player} per player
                    </span>
                  )}
                  {(p.valid_from || p.valid_until) && (
                    <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                      {day(p.valid_from) || 'Now'} → {day(p.valid_until) || 'no end'}
                    </span>
                  )}
                </div>
                <div className="relative mt-4 flex gap-2 border-t border-border-subtle pt-3">
                  <Button
                    size="sm"
                    variant="soft"
                    icon={Pencil}
                    onClick={() => setEditing(p)}
                    testID={`edit-${p.code}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => setDeleting(p)}
                    testID={`delete-${p.code}`}
                  >
                    Delete
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="New promo code"
        subtitle="Players enter this at checkout."
        testID="promo-drawer"
      >
        {creating && (
          <PromoForm
            onCreated={async (code) => {
              toast.success(`${code} created`);
              setCreating(false);
              await load(true);
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.code}` : 'Edit code'}
        subtitle="The code itself cannot change. Switch it off and create a new one for that."
        testID="promo-edit-drawer"
      >
        {editing && (
          <EditPromoForm
            promo={editing}
            onSaved={async () => {
              toast.success(`${editing.code} updated`);
              setEditing(null);
              await load(true);
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this promo code?"
        message={
          deleting
            ? `${deleting.code} will be removed. A code players have already used cannot be deleted. Switch it off instead.`
            : ''
        }
        confirmLabel="Delete code"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="promo-delete-dialog"
      />
    </div>
  );
}

function EditPromoForm({ promo, onSaved }: { promo: AdminPromoCode; onSaved: () => void }) {
  const [value, setValue] = useState(String(Number(promo.discount_value)));
  const [maxDiscount, setMaxDiscount] = useState(
    promo.max_discount_amount != null ? String(Number(promo.max_discount_amount)) : '',
  );
  const [minBooking, setMinBooking] = useState(String(Number(promo.min_booking_amount)));
  const [totalLimit, setTotalLimit] = useState(
    promo.usage_limit_total != null ? String(promo.usage_limit_total) : '',
  );
  const [perPlayer, setPerPlayer] = useState(
    promo.usage_limit_per_player != null ? String(promo.usage_limit_per_player) : '',
  );
  const [from, setFrom] = useState(promo.valid_from ? promo.valid_from.slice(0, 10) : '');
  const [until, setUntil] = useState(promo.valid_until ? promo.valid_until.slice(0, 10) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const v = Number(value);
    if (!(v > 0)) return setError('Enter a discount greater than 0.');
    if (promo.discount_type === 'PERCENTAGE' && v > 100)
      return setError('A percentage discount cannot be more than 100.');
    if (from && until && until < from)
      return setError('The end date must be after the start date.');
    setError(null);
    setSaving(true);
    const input: UpdatePromoCodeInput = {
      discount_value: v,
      max_discount_amount:
        promo.discount_type === 'PERCENTAGE' && maxDiscount ? Number(maxDiscount) : null,
      min_booking_amount: Number(minBooking || 0),
      usage_limit_total: totalLimit ? Number(totalLimit) : null,
      usage_limit_per_player: perPlayer ? Number(perPlayer) : null,
      valid_from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
      valid_until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
    };
    try {
      await apiClient.updatePromoCode(promo.promo_code_id, input);
      onSaved();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the changes.');
    } finally {
      setSaving(false);
    }
  }

  const field =
    'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary transition-all hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
  const label = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="promo-edit-form"
    >
      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>
            {promo.discount_type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'}
          </span>
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="edit-promo-value"
            className={field}
          />
        </label>
        {promo.discount_type === 'PERCENTAGE' && (
          <label className="block">
            <span className={label}>Max discount (₹)</span>
            <input
              type="number"
              min="0"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              data-testid="edit-promo-max"
              className={field}
            />
          </label>
        )}
      </div>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <label className="block">
          <span className={label}>Min booking (₹)</span>
          <input
            type="number"
            min="0"
            value={minBooking}
            onChange={(e) => setMinBooking(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Total uses</span>
          <input
            type="number"
            min="1"
            value={totalLimit}
            onChange={(e) => setTotalLimit(e.target.value)}
            placeholder="∞"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Per player</span>
          <input
            type="number"
            min="1"
            value={perPlayer}
            onChange={(e) => setPerPlayer(e.target.value)}
            placeholder="∞"
            className={field}
          />
        </label>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>Valid from</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Valid until</span>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className={field}
          />
        </label>
      </div>
      {error && (
        <p
          role="alert"
          data-testid="promo-edit-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="promo-edit-submit">
        Save changes
      </Button>
    </form>
  );
}

function PromoForm({ onCreated }: { onCreated: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minBooking, setMinBooking] = useState('');
  const [totalLimit, setTotalLimit] = useState('');
  const [perPlayer, setPerPlayer] = useState('1');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validate(): string | null {
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(code.trim()))
      return 'Code must be 3–30 letters, numbers, - or _.';
    const v = Number(value);
    if (!(v > 0)) return 'Enter a discount greater than 0.';
    if (type === 'PERCENTAGE' && v > 100) return 'A percentage discount can’t be more than 100.';
    if (from && until && until < from) return 'The end date must be after the start date.';
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    const input: CreatePromoCodeInput = {
      code: code.trim().toUpperCase(),
      discount_type: type,
      discount_value: Number(value),
      ...(type === 'PERCENTAGE' && maxDiscount ? { max_discount_amount: Number(maxDiscount) } : {}),
      ...(minBooking ? { min_booking_amount: Number(minBooking) } : {}),
      ...(totalLimit ? { usage_limit_total: Number(totalLimit) } : {}),
      ...(perPlayer ? { usage_limit_per_player: Number(perPlayer) } : {}),
      ...(from ? { valid_from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(until ? { valid_until: new Date(`${until}T23:59:59`).toISOString() } : {}),
    };
    try {
      await apiClient.createPromoCode(input);
      onCreated(input.code);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not create the code.');
    } finally {
      setSaving(false);
    }
  }

  const field =
    'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary transition-all hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
  const label = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="promo-form"
    >
      <label className="mb-4 block">
        <span className={label}>Code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="WELCOME20"
          data-testid="promo-code"
          className={`${field} font-display text-[20px] tracking-widest`}
        />
      </label>

      <div className="mb-4">
        <span className={label}>Discount type</span>
        <div className="mt-1">
          <SegmentedControl<'PERCENTAGE' | 'FLAT'>
            testIDPrefix="promo-type"
            value={type}
            onChange={setType}
            options={[
              { value: 'PERCENTAGE', label: 'Percentage' },
              { value: 'FLAT', label: 'Flat amount' },
            ]}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>{type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'}</span>
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="promo-value"
            className={field}
          />
        </label>
        {type === 'PERCENTAGE' && (
          <label className="block">
            <span className={label}>Max discount (₹, optional)</span>
            <input
              type="number"
              min="0"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              data-testid="promo-max"
              className={field}
            />
          </label>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <label className="block">
          <span className={label}>Min booking (₹)</span>
          <input
            type="number"
            min="0"
            value={minBooking}
            onChange={(e) => setMinBooking(e.target.value)}
            data-testid="promo-min"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Total uses</span>
          <input
            type="number"
            min="1"
            value={totalLimit}
            onChange={(e) => setTotalLimit(e.target.value)}
            placeholder="∞"
            data-testid="promo-total"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Per player</span>
          <input
            type="number"
            min="1"
            value={perPlayer}
            onChange={(e) => setPerPlayer(e.target.value)}
            data-testid="promo-per-player"
            className={field}
          />
        </label>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>Valid from</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="promo-from"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Valid until</span>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            data-testid="promo-until"
            className={field}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="promo-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" loading={saving} testID="promo-submit">
        Create code
      </Button>
    </form>
  );
}
