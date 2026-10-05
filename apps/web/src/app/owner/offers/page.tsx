'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { OwnerOffer, OwnerOfferInput, Turf } from '@bfam/shared-types';
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
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

type OfferState = 'LIVE' | 'OFF' | 'SCHEDULED' | 'EXPIRED';

function stateOf(o: OwnerOffer, now = new Date()): OfferState {
  if (!o.is_active) return 'OFF';
  if (o.valid_from && new Date(o.valid_from) > now) return 'SCHEDULED';
  if (o.valid_until && new Date(o.valid_until) < now) return 'EXPIRED';
  return 'LIVE';
}
const TONE: Record<OfferState, Tone> = {
  LIVE: 'success',
  OFF: 'neutral',
  SCHEDULED: 'info',
  EXPIRED: 'warning',
};

const offerLabel = (o: OwnerOffer) =>
  o.discount_type === 'PERCENTAGE'
    ? `${o.discount_value}% off${o.max_discount_amount ? ` (up to ${formatRupees(o.max_discount_amount)})` : ''}`
    : `${formatRupees(o.discount_value)} off`;

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[42px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

// Offers (OW-8, PRD §22.1): discount codes an owner creates for their own turfs.
// Players enter them at checkout like any promo code; they only work at this
// owner's turfs (or the one turf chosen here).
export default function OwnerOffersPage() {
  const toast = useToast();
  const [offers, setOffers] = useState<OwnerOffer[]>([]);
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OwnerOffer | 'new' | null>(null);
  const [deleting, setDeleting] = useState<OwnerOffer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setOffers((await apiClient.getOwnerOffers()).results);
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = useMemo(() => offers.filter((o) => stateOf(o) === 'LIVE').length, [offers]);

  async function toggle(o: OwnerOffer, next: boolean) {
    setBusyId(o.promo_code_id);
    setOffers((list) =>
      list.map((x) => (x.promo_code_id === o.promo_code_id ? { ...x, is_active: next } : x)),
    );
    try {
      await apiClient.setOwnerOfferActive(o.promo_code_id, next);
      toast.success(`${o.code} is now ${next ? 'on' : 'off'}`);
    } catch (err) {
      setOffers((list) =>
        list.map((x) =>
          x.promo_code_id === o.promo_code_id ? { ...x, is_active: o.is_active } : x,
        ),
      );
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not change that offer.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteOwnerOffer(deleting.promo_code_id);
      toast.success(`${deleting.code} was deleted`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not delete that offer.');
      setDeleting(null);
    }
  }

  return (
    <div data-testid="owner-offers-page">
      <PageHeader
        title="Offers"
        subtitle={
          live > 0
            ? `${live} live now · discounts for your own turfs.`
            : 'Discounts for your own turfs.'
        }
        action={
          <Button
            icon={Plus}
            onClick={() => setEditing('new')}
            testID="new-offer"
            disabled={turfs.length === 0}
          >
            New offer
          </Button>
        }
      />

      {loading ? (
        <SkeletonRows rows={3} />
      ) : offers.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No offers yet"
          message="Create a code to bring players back — like WELCOME20 for 20% off a first booking."
          testID="offers-empty"
          action={
            turfs.length > 0 ? (
              <Button icon={Plus} onClick={() => setEditing('new')}>
                New offer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="offer-list">
          {offers.map((o, index) => {
            const state = stateOf(o);
            return (
              <motion.li
                key={o.promo_code_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: EASE_OUT }}
                data-testid={`offer-${o.code}`}
                className={`relative overflow-hidden rounded-lg border bg-surface p-5 ${state === 'LIVE' ? 'border-brand-red/30' : 'border-border-subtle'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-[32px] leading-none tracking-wider text-ink-black">
                      {o.code}
                    </p>
                    <p className="mt-2 font-ui text-card-title font-bold text-brand-red">
                      {offerLabel(o)}
                    </p>
                  </div>
                  <Toggle
                    checked={o.is_active}
                    onChange={(next) => toggle(o, next)}
                    label={`${o.code} active`}
                    disabled={busyId === o.promo_code_id}
                    testID={`offer-toggle-${o.code}`}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusPill tone={TONE[state]} label={state} pulse={state === 'LIVE'} />
                  <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                    {o.turf_name ?? 'All your turfs'}
                  </span>
                  <span
                    className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary"
                    data-testid={`redeemed-${o.code}`}
                  >
                    Used {o.redeemed}
                    {o.usage_limit_total != null ? ` of ${o.usage_limit_total}` : ''}
                  </span>
                  {o.min_booking_amount > 0 && (
                    <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                      Min booking {formatRupees(o.min_booking_amount)}
                    </span>
                  )}
                  {(o.valid_from || o.valid_until) && (
                    <span className="rounded-md bg-ink-black/[0.05] px-2 py-[3px] font-ui text-[12px] text-text-secondary">
                      {day(o.valid_from) || 'Now'} → {day(o.valid_until) || 'no end'}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex gap-2 border-t border-border-subtle pt-3">
                  <Button
                    size="sm"
                    variant="soft"
                    icon={Pencil}
                    onClick={() => setEditing(o)}
                    testID={`edit-offer-${o.code}`}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => setDeleting(o)}
                    testID={`delete-offer-${o.code}`}
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
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New offer' : `Edit ${editing?.code ?? ''}`}
        subtitle={
          editing === 'new' ? 'Players enter this at checkout.' : 'The code itself cannot change.'
        }
        testID="offer-drawer"
      >
        {editing !== null && (
          <OfferForm
            turfs={turfs}
            offer={editing === 'new' ? null : editing}
            onSaved={async (code) => {
              toast.success(editing === 'new' ? `${code} created` : `${code} updated`);
              setEditing(null);
              await load();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this offer?"
        message={
          deleting
            ? `${deleting.code} is removed. An offer players already used can't be deleted: switch it off instead.`
            : ''
        }
        confirmLabel="Delete offer"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        testID="offer-delete-dialog"
      />
    </div>
  );
}

function OfferForm({
  turfs,
  offer,
  onSaved,
}: {
  turfs: Turf[];
  offer: OwnerOffer | null;
  onSaved: (code: string) => void | Promise<void>;
}) {
  const [code, setCode] = useState(offer?.code ?? '');
  const [type, setType] = useState<'PERCENTAGE' | 'FLAT'>(offer?.discount_type ?? 'PERCENTAGE');
  const [value, setValue] = useState(offer ? String(offer.discount_value) : '');
  const [maxDiscount, setMaxDiscount] = useState(
    offer?.max_discount_amount != null ? String(offer.max_discount_amount) : '',
  );
  const [minBooking, setMinBooking] = useState(offer ? String(offer.min_booking_amount) : '');
  const [totalLimit, setTotalLimit] = useState(
    offer?.usage_limit_total != null ? String(offer.usage_limit_total) : '',
  );
  const [perPlayer, setPerPlayer] = useState(
    offer
      ? offer.usage_limit_per_player != null
        ? String(offer.usage_limit_per_player)
        : ''
      : '1',
  );
  const [from, setFrom] = useState(offer?.valid_from ? offer.valid_from.slice(0, 10) : '');
  const [until, setUntil] = useState(offer?.valid_until ? offer.valid_until.slice(0, 10) : '');
  const [turfId, setTurfId] = useState(offer?.turf_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!offer && !/^[A-Za-z0-9_-]{3,30}$/.test(code.trim()))
      return setError('Code must be 3–30 letters, numbers, - or _.');
    const v = Number(value);
    if (!(v > 0)) return setError('Enter a discount greater than 0.');
    if (type === 'PERCENTAGE' && v > 100)
      return setError('A percentage discount can’t be more than 100.');
    if (from && until && until < from)
      return setError('The end date must be after the start date.');
    setError(null);
    setSaving(true);
    const body = {
      discount_type: type,
      discount_value: v,
      max_discount_amount: type === 'PERCENTAGE' && maxDiscount ? Number(maxDiscount) : null,
      min_booking_amount: Number(minBooking || 0),
      usage_limit_total: totalLimit ? Number(totalLimit) : null,
      usage_limit_per_player: perPlayer ? Number(perPlayer) : null,
      valid_from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
      valid_until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
      turf_id: turfId || null,
    };
    try {
      if (offer) await apiClient.updateOwnerOffer(offer.promo_code_id, body);
      else
        await apiClient.createOwnerOffer({
          code: code.trim().toUpperCase(),
          ...body,
        } as OwnerOfferInput);
      await onSaved(offer ? offer.code : code.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not save the offer.');
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
      data-testid="offer-form"
    >
      {!offer && (
        <label className="mb-4 block">
          <span className={LABEL}>Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME20"
            data-testid="offer-code"
            className={`${FIELD} font-display text-[20px] tracking-widest`}
          />
        </label>
      )}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL}>Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'PERCENTAGE' | 'FLAT')}
            data-testid="offer-type"
            className={FIELD}
          >
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FLAT">Flat amount off</option>
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>{type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'}</span>
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="offer-value"
            className={FIELD}
          />
        </label>
        {type === 'PERCENTAGE' && (
          <label className="block">
            <span className={LABEL}>Max discount (₹)</span>
            <input
              type="number"
              min="0"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              data-testid="offer-max"
              className={FIELD}
            />
          </label>
        )}
        <label className="block">
          <span className={LABEL}>Min booking (₹)</span>
          <input
            type="number"
            min="0"
            value={minBooking}
            onChange={(e) => setMinBooking(e.target.value)}
            data-testid="offer-min"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Total uses</span>
          <input
            type="number"
            min="1"
            value={totalLimit}
            onChange={(e) => setTotalLimit(e.target.value)}
            placeholder="∞"
            data-testid="offer-total"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Per player</span>
          <input
            type="number"
            min="1"
            value={perPlayer}
            onChange={(e) => setPerPlayer(e.target.value)}
            placeholder="∞"
            data-testid="offer-per-player"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Valid from</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="offer-from"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Valid until</span>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            data-testid="offer-until"
            className={FIELD}
          />
        </label>
      </div>
      <label className="mb-5 block">
        <span className={LABEL}>Works at</span>
        <select
          value={turfId}
          onChange={(e) => setTurfId(e.target.value)}
          data-testid="offer-turf"
          className={FIELD}
        >
          <option value="">All my turfs</option>
          {turfs.map((t) => (
            <option key={t.turf_id} value={t.turf_id}>
              {t.turf_name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p
          role="alert"
          data-testid="offer-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="offer-submit">
        {offer ? 'Save changes' : 'Create offer'}
      </Button>
    </form>
  );
}
