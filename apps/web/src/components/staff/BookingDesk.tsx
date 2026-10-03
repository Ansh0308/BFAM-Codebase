'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Receipt,
  Swords,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  BookingMatches,
  MatchPlayer,
  OwnerBooking,
  Payment,
  PaymentObligation,
} from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { Button, EmptyState, SegmentedControl, Skeleton, StatusPill, type Tone } from '../ui/kit';
import { useToast } from '../ui/Toast';
import { EASE_OUT } from '../ui/motion';
import { RosterPanel } from './RosterPanel';

type DeskTab = 'checkin' | 'payments' | 'details';

export const BOOKING_TONE: Record<string, Tone> = {
  CONFIRMED: 'success',
  PENDING: 'warning',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
};

const OBLIGATION_TONE: Record<string, Tone> = {
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  PENDING: 'warning',
  CANCELLED: 'neutral',
};

export function hhmm(time: string): string {
  return time.slice(0, 5);
}

// A match's scheduled start is a full timestamp; show it as local clock time.
function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function rupees(n: number | string): string {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof BFAMApiError ? err.message : fallback;
}

// Everything a desk needs for one booking, in one panel: who has arrived for
// the match(es) played in the slot, what is still owed (and a one-click cash
// collection), and the booking's own details. All calls are the same
// endpoints Staff Mobile uses; verification is enforced by the server.
export function BookingDesk({ booking, canAct }: { booking: OwnerBooking; canAct: boolean }) {
  const toast = useToast();
  const [tab, setTab] = useState<DeskTab>('checkin');
  const [slot, setSlot] = useState<BookingMatches | null>(null);
  const [obligations, setObligations] = useState<PaymentObligation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, o, p] = await Promise.allSettled([
      apiClient.getBookingMatches(booking.booking_id),
      apiClient.getObligations(booking.booking_id),
      apiClient.getBookingPayments(booking.booking_id),
    ]);
    if (s.status === 'fulfilled') {
      setSlot(s.value);
      setMatchId((prev) => prev ?? s.value.matches[0]?.match_id ?? null);
    }
    if (o.status === 'fulfilled') setObligations(o.value.results);
    if (p.status === 'fulfilled') setPayments(p.value.results);
    setLoading(false);
  }, [booking.booking_id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!matchId) {
      setPlayers([]);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    apiClient
      .getGameRoom(matchId)
      .then((room) => {
        if (!cancelled) setPlayers(room.players);
      })
      .catch(() => {
        if (!cancelled) setPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const owed = useMemo(
    () =>
      obligations.filter((o) => o.due_status === 'PENDING' || o.due_status === 'PARTIALLY_PAID'),
    [obligations],
  );
  const totalDue = obligations.reduce((sum, o) => sum + Number(o.amount_due), 0);
  const totalPaid = obligations
    .filter((o) => o.due_status === 'PAID')
    .reduce((sum, o) => sum + Number(o.amount_due), 0);

  return (
    <div data-testid="booking-desk">
      <div className="mb-6">
        <SegmentedControl<DeskTab>
          testIDPrefix="desk-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'checkin', label: 'Check-in' },
            { value: 'payments', label: 'Payments', count: owed.length },
            { value: 'details', label: 'Details' },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-[88px] w-full" />
              <Skeleton className="h-[56px] w-full" />
              <Skeleton className="h-[56px] w-full" />
            </div>
          ) : tab === 'checkin' ? (
            <CheckinTab
              slot={slot}
              matchId={matchId}
              onSelectMatch={setMatchId}
              players={players}
              onPlayersChange={setPlayers}
              rosterLoading={rosterLoading}
              canAct={canAct}
            />
          ) : tab === 'payments' ? (
            <PaymentsTab
              obligations={obligations}
              owed={owed}
              payments={payments}
              totalDue={totalDue}
              totalPaid={totalPaid}
              canAct={canAct}
              onRecorded={() => {
                toast.success('Cash payment recorded');
                loadAll();
              }}
            />
          ) : (
            <DetailsTab booking={booking} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CheckinTab({
  slot,
  matchId,
  onSelectMatch,
  players,
  onPlayersChange,
  rosterLoading,
  canAct,
}: {
  slot: BookingMatches | null;
  matchId: string | null;
  onSelectMatch: (id: string) => void;
  players: MatchPlayer[];
  onPlayersChange: (p: MatchPlayer[]) => void;
  rosterLoading: boolean;
  canAct: boolean;
}) {
  if (!slot || slot.matches.length === 0) {
    return (
      <EmptyState
        icon={Swords}
        title="No match yet"
        message="Nobody has created a match for this slot, so there is no roster to check in. Players can create one from the app."
        testID="desk-no-match"
      />
    );
  }
  return (
    <div>
      {slot.matches.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Matches in this slot">
          {slot.matches.map((m, i) => (
            <button
              key={m.match_id}
              role="tab"
              aria-selected={m.match_id === matchId}
              onClick={() => onSelectMatch(m.match_id)}
              className={`rounded-md border px-3 h-[36px] font-ui text-[13px] font-semibold cursor-pointer transition-colors ${
                m.match_id === matchId
                  ? 'border-brand-red bg-brand-red/10 text-brand-red'
                  : 'border-border-strong text-text-secondary hover:border-brand-red hover:text-brand-red'
              }`}
            >
              {m.match_name || `Match ${i + 1}`} · {timeOf(m.scheduled_start_time)}
            </button>
          ))}
        </div>
      )}
      {rosterLoading || !matchId ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-[96px] w-full" />
          <Skeleton className="h-[56px] w-full" />
          <Skeleton className="h-[56px] w-full" />
        </div>
      ) : (
        <RosterPanel
          matchId={matchId}
          players={players}
          onChange={onPlayersChange}
          canAct={canAct}
        />
      )}
    </div>
  );
}

function PaymentsTab({
  obligations,
  owed,
  payments,
  totalDue,
  totalPaid,
  canAct,
  onRecorded,
}: {
  obligations: PaymentObligation[];
  owed: PaymentObligation[];
  payments: Payment[];
  totalDue: number;
  totalPaid: number;
  canAct: boolean;
  onRecorded: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedTotal = owed
    .filter((o) => selected.has(o.obligation_id))
    .reduce((sum, o) => sum + Number(o.amount_due), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function collect() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await apiClient.recordCashPayment([...selected], reference.trim() || undefined);
      setSelected(new Set());
      setReference('');
      onRecorded();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the cash payment. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  if (obligations.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nothing to collect"
        message="No payment obligations have been created for this booking yet."
        testID="desk-no-obligations"
      />
    );
  }

  const paidPct = totalDue === 0 ? 0 : Math.round((totalPaid / totalDue) * 100);

  return (
    <div data-testid="desk-payments">
      <div className="rounded-lg bg-ink-black text-white p-5 mb-5 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-[120px] w-[120px] rounded-[999px] bg-brand-red/40"
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="font-ui text-micro uppercase tracking-wider text-white/60">Collected</p>
            <p className="font-display text-[40px] leading-none">
              {rupees(totalPaid)}
              <span className="text-white/50 text-[22px]"> / {rupees(totalDue)}</span>
            </p>
          </div>
          <StatusPill
            tone={owed.length === 0 ? 'success' : 'warning'}
            label={owed.length === 0 ? 'Settled' : `${owed.length} pending`}
          />
        </div>
        <div className="relative mt-4 h-[6px] rounded-[999px] bg-white/15 overflow-hidden">
          <motion.div
            className="h-full rounded-[999px] bg-brand-red"
            initial={{ width: 0 }}
            animate={{ width: `${paidPct}%` }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
          />
        </div>
      </div>

      <ul className="space-y-2 mb-5">
        {obligations.map((o) => {
          const payable = o.due_status === 'PENDING' || o.due_status === 'PARTIALLY_PAID';
          const isSelected = selected.has(o.obligation_id);
          return (
            <li key={o.obligation_id}>
              <label
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors duration-200 ${
                  payable && canAct ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isSelected
                    ? 'border-brand-red bg-brand-red/[0.04]'
                    : 'border-border-subtle bg-surface hover:border-border-strong'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!payable || !canAct}
                  onChange={() => toggle(o.obligation_id)}
                  data-testid={`obligation-${o.obligation_id}`}
                  aria-label={`Select ${rupees(o.amount_due)} obligation`}
                  className="h-[18px] w-[18px] accent-[#D80000] cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="flex-1 font-ui text-body font-semibold text-ink-black">
                  {rupees(o.amount_due)}
                  <span className="ml-2 font-normal text-text-tertiary text-[12px]">
                    {o.player_id ? 'Player share' : 'Booking share'}
                  </span>
                </span>
                <StatusPill
                  tone={OBLIGATION_TONE[o.due_status] ?? 'neutral'}
                  label={o.due_status.replace('_', ' ')}
                />
              </label>
            </li>
          );
        })}
      </ul>

      {canAct && owed.length > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-alt p-4 mb-6">
          <label className="block mb-3">
            <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
              Cash reference (optional)
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Receipt or note"
              data-testid="cash-reference"
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[40px] font-ui text-body focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selected.size === owed.length
                    ? new Set()
                    : new Set(owed.map((o) => o.obligation_id)),
                )
              }
              className="font-ui text-[13px] font-semibold text-text-secondary hover:text-brand-red cursor-pointer"
              data-testid="select-all-owed"
            >
              {selected.size === owed.length ? 'Clear selection' : 'Select all pending'}
            </button>
            <Button
              icon={Banknote}
              loading={saving}
              disabled={selected.size === 0}
              onClick={collect}
              testID="collect-cash"
            >
              Collect {selected.size > 0 ? rupees(selectedTotal) : 'cash'}
            </Button>
          </div>
        </div>
      )}
      {!canAct && owed.length > 0 && (
        <p className="font-ui text-body text-text-tertiary mb-6">
          Cash collection unlocks once the owner verifies your ID.
        </p>
      )}

      {payments.length > 0 && (
        <div>
          <h3 className="font-ui text-micro uppercase tracking-wider text-text-secondary mb-3">
            Payment history
          </h3>
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.payment_id}
                className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-3"
              >
                <span className="font-ui text-body text-ink-black">
                  {rupees(p.amount)}
                  <span className="ml-2 text-text-tertiary text-[12px]">{p.payment_method}</span>
                </span>
                <StatusPill
                  tone={
                    p.payment_status === 'SUCCESS'
                      ? 'success'
                      : p.payment_status === 'FAILED'
                        ? 'danger'
                        : 'warning'
                  }
                  label={p.payment_status}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DetailsTab({ booking }: { booking: OwnerBooking }) {
  const [copied, setCopied] = useState(false);
  const rows: [string, string][] = [
    ['Turf', booking.turf_name],
    ['Date', booking.booking_date.slice(0, 10)],
    [
      'Slot',
      `${hhmm(booking.start_time)} – ${hhmm(booking.end_time)} (${booking.duration_minutes} min)`,
    ],
    ['Amount', rupees(booking.booking_amount)],
    ['Payment mode', booking.payment_mode],
  ];
  return (
    <div data-testid="desk-details">
      <dl className="rounded-lg border border-border-subtle divide-y divide-border-subtle overflow-hidden">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 bg-surface">
            <dt className="font-ui text-micro uppercase tracking-wider text-text-tertiary">{k}</dt>
            <dd className="font-ui text-body font-semibold text-ink-black text-right">{v}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-surface">
          <dt className="font-ui text-micro uppercase tracking-wider text-text-tertiary">Status</dt>
          <dd>
            <StatusPill
              tone={BOOKING_TONE[booking.booking_status] ?? 'neutral'}
              label={booking.booking_status}
            />
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(booking.booking_id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
        className="mt-4 inline-flex items-center gap-2 font-ui text-[13px] font-semibold text-text-secondary hover:text-brand-red cursor-pointer transition-colors"
        data-testid="copy-booking-id"
      >
        {copied ? (
          <CheckCircle2 className="h-[16px] w-[16px] text-brand-red" />
        ) : (
          <ClipboardList className="h-[16px] w-[16px]" />
        )}
        {copied ? 'Copied' : `Copy booking ID · ${booking.booking_id.slice(0, 8)}…`}
      </button>
      {booking.cancellation_reason ? (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger">
          <CalendarClock className="mt-[2px] h-[16px] w-[16px] shrink-0" />
          Cancelled: {booking.cancellation_reason}
        </p>
      ) : null}
    </div>
  );
}
