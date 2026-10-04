'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck, RefreshCw } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AdminBookingRow } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { addDays, formatDay, formatRupees, hhmm, humanize, todayISO } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { EASE_OUT } from '../../../components/ui/motion';
import { useToast } from '../../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SearchInput,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

const STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'info',
  CANCELLED: 'neutral',
};
const SETTABLE = ['PENDING', 'CONFIRMED', 'COMPLETED'] as const;

const FIELD =
  'rounded-md border border-border-strong bg-surface px-3 h-[40px] font-ui text-body text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';

// Bookings across every turf (PRD §9.1 "booking oversight"). Admins can
// correct a booking's status here; cancelling still goes through the normal
// cancel flow (the owner's Bookings page, via "Manage as") because it frees
// the slot and settles money.
export default function AdminBookingsPage() {
  const toast = useToast();
  const [from, setFrom] = useState(() => addDays(todayISO(), -7));
  const [to, setTo] = useState(() => addDays(todayISO(), 14));
  const [rows, setRows] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const res = await apiClient.getAdminBookings({ from, to });
        setRows(res.results);
      } catch (err) {
        setRows([]);
        setError(err instanceof BFAMApiError ? err.message : 'Could not load bookings.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (b) =>
        b.turf_name.toLowerCase().includes(q) ||
        (b.customer_name ?? '').toLowerCase().includes(q) ||
        (b.customer_phone ?? '').includes(q) ||
        b.booking_id.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function setStatus(b: AdminBookingRow, status: (typeof SETTABLE)[number]) {
    try {
      await apiClient.setAdminBookingStatus(b.booking_id, status);
      setRows((prev) => prev.map((x) => (x.booking_id === b.booking_id ? { ...x, status } : x)));
      toast.success(`Booking marked ${humanize(status).toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not change that booking.');
    }
  }

  return (
    <div data-testid="admin-bookings-page">
      <PageHeader
        title="Bookings"
        subtitle="Every booking on every turf."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            testID="bookings-refresh"
          >
            Refresh
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">
            From
          </span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="bookings-from"
            className={`${FIELD} mt-1 block`}
          />
        </label>
        <label className="block">
          <span className="font-ui text-micro uppercase tracking-wide text-text-secondary">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            data-testid="bookings-to"
            className={`${FIELD} mt-1 block`}
          />
        </label>
        <div className="min-w-[260px] flex-1 max-w-md">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Turf, customer or phone"
            ariaLabel="Search bookings"
            testID="bookings-search"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 font-ui text-body text-brand-red"
          data-testid="bookings-error"
        >
          {error}
        </p>
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No bookings"
          message="Nothing booked in this date range."
          testID="bookings-empty"
        />
      ) : (
        <ul className="space-y-3" data-testid="booking-list">
          {visible.map((b, index) => {
            const due = Number(b.amount_due);
            const paid = Number(b.amount_paid);
            const cancelled = b.status === 'CANCELLED';
            return (
              <motion.li
                key={b.booking_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.03, ease: EASE_OUT }}
                data-testid={`booking-${b.booking_id}`}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
              >
                <div className="w-[120px]">
                  <p className="font-ui text-card-title font-bold text-ink-black">
                    {formatDay(b.booking_date)}
                  </p>
                  <p className="font-ui text-body text-text-tertiary">
                    {hhmm(b.start_time)}–{hhmm(b.end_time)}
                  </p>
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="font-ui text-body font-bold text-ink-black">{b.turf_name}</p>
                  <p className="font-ui text-body text-text-tertiary">
                    {b.customer_name ?? 'Walk-in'}
                    {b.customer_phone ? ` · ${b.customer_phone}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-ui text-body font-bold text-ink-black">{formatRupees(due)}</p>
                  <p className="font-ui text-micro text-text-tertiary">{formatRupees(paid)} paid</p>
                </div>
                <StatusPill label={b.status} tone={STATUS_TONE[b.status] ?? 'neutral'} />
                {!cancelled && (
                  <select
                    aria-label={`Set status for booking at ${b.turf_name}`}
                    value={b.status}
                    onChange={(e) => setStatus(b, e.target.value as (typeof SETTABLE)[number])}
                    data-testid={`status-${b.booking_id}`}
                    className={FIELD}
                  >
                    {SETTABLE.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
