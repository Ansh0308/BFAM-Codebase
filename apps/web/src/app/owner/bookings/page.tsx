'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarX2, ChevronRight, IndianRupee, ListChecks, RefreshCw, Wallet } from 'lucide-react';
import type { OwnerBookingRow, Turf } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { addDays, formatDay, formatRupees, hhmm, todayISO } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { BookingDetail, BOOKING_TONE } from '../../../components/owner/BookingDetail';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import {
  Button,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatTile,
  StatusPill,
} from '../../../components/ui/kit';

type RangeKey = 'today' | 'tomorrow' | 'week' | 'past';
type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'CANCELLED';

function rangeFor(key: RangeKey): { from: string; to: string } {
  const today = todayISO();
  switch (key) {
    case 'tomorrow':
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case 'week':
      return { from: today, to: addDays(today, 6) };
    case 'past':
      return { from: addDays(today, -7), to: addDays(today, -1) };
    default:
      return { from: today, to: today };
  }
}

// Booking Management (module 2.12, PRD §8.3/§9.2/§30.9) — every booking at
// the owner's turfs for a chosen window, with the customer, what has been
// paid, and a detail panel where the owner can review payments or cancel.
export default function OwnerBookingsPage() {
  const [range, setRange] = useState<RangeKey>('today');
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [bookings, setBookings] = useState<OwnerBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<OwnerBookingRow | null>(null);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => setTurfs(res.results))
      .catch(() => setTurfs([]));
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await apiClient.getOwnerBookings({
          ...rangeFor(range),
          ...(turfId ? { turf_id: turfId } : {}),
        });
        setBookings(res.results);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, turfId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      ALL: bookings.length,
      CONFIRMED: 0,
      PENDING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const b of bookings) c[b.booking_status as Exclude<StatusFilter, 'ALL'>] += 1;
    return c;
  }, [bookings]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (status !== 'ALL' && b.booking_status !== status) return false;
      if (!q) return true;
      return [b.customer_name, b.customer_phone, b.turf_name, b.booking_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [bookings, status, query]);

  const live = visible.filter((b) => b.booking_status !== 'CANCELLED');
  const revenue = live.reduce((s, b) => s + Number(b.booking_amount), 0);
  const collected = live.reduce((s, b) => s + Number(b.amount_paid), 0);
  const outstanding = Math.max(live.reduce((s, b) => s + Number(b.amount_due), 0) - collected, 0);

  const byDay = useMemo(() => {
    const groups = new Map<string, OwnerBookingRow[]>();
    for (const b of visible) {
      const key = b.booking_date.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), b]);
    }
    return [...groups.entries()];
  }, [visible]);

  return (
    <div data-testid="owner-bookings-page">
      <PageHeader
        title="Bookings"
        subtitle="Every booking at your turfs — who booked, what's paid, and what needs attention."
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        <StatTile
          label="Bookings"
          value={live.length}
          icon={ListChecks}
          tone="brand"
          delay={0.05}
          hint="Excluding cancelled"
        />
        <StatTile
          label="Booked value"
          value={revenue}
          prefix="₹"
          icon={IndianRupee}
          delay={0.1}
          hint="Total of these bookings"
        />
        <StatTile
          label="Collected"
          value={collected}
          prefix="₹"
          icon={Wallet}
          delay={0.15}
          hint="Paid so far"
        />
        <StatTile
          label="Outstanding"
          value={outstanding}
          prefix="₹"
          icon={CalendarX2}
          delay={0.2}
          hint="Still to collect"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SegmentedControl<RangeKey>
          testIDPrefix="range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'week', label: 'Next 7 days' },
            { value: 'past', label: 'Last 7 days' },
          ]}
        />
        {turfs.length > 1 && (
          <select
            value={turfId}
            onChange={(e) => setTurfId(e.target.value)}
            aria-label="Filter by turf"
            data-testid="turf-filter"
            className="h-[42px] rounded-md border border-border-strong bg-surface px-3 font-ui text-body text-text-primary cursor-pointer hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
          >
            <option value="">All turfs</option>
            {turfs.map((t) => (
              <option key={t.turf_id} value={t.turf_id}>
                {t.turf_name}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto w-full max-w-[340px]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search customer, phone, turf or ID"
            ariaLabel="Search bookings"
            testID="booking-search"
          />
        </div>
      </div>

      <div className="mb-6">
        <SegmentedControl<StatusFilter>
          testIDPrefix="status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'CONFIRMED', label: 'Confirmed', count: counts.CONFIRMED },
            { value: 'PENDING', label: 'Pending', count: counts.PENDING },
            { value: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
            { value: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No bookings"
          message={
            bookings.length === 0
              ? 'No bookings in this window.'
              : 'No bookings match these filters.'
          }
          testID="bookings-empty"
        />
      ) : (
        <div className="space-y-7" data-testid="bookings-list">
          {byDay.map(([day, rows]) => (
            <section key={day}>
              <h2 className="sticky top-[64px] z-10 -mx-1 mb-3 bg-surface-alt/90 px-1 py-2 font-ui text-micro uppercase tracking-[0.16em] text-text-secondary backdrop-blur">
                {formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}
                <span className="ml-2 text-text-tertiary">· {rows.length}</span>
              </h2>
              <ul className="space-y-3">
                {rows.map((b, index) => {
                  const due = Number(b.amount_due);
                  const paid = Number(b.amount_paid);
                  const pct = due === 0 ? 0 : Math.min(100, Math.round((paid / due) * 100));
                  return (
                    <motion.li
                      key={b.booking_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: Math.min(index, 8) * 0.04,
                        ease: EASE_OUT,
                      }}
                    >
                      <motion.button
                        type="button"
                        onClick={() => setOpen(b)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.995 }}
                        data-testid={`booking-row-${b.booking_id}`}
                        aria-label={`Open booking at ${b.turf_name} ${hhmm(b.start_time)}`}
                        className={`group grid w-full grid-cols-[88px_1fr_auto] items-center gap-5 rounded-lg border bg-surface px-5 py-4 text-left cursor-pointer transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.09)] ${
                          b.booking_status === 'CANCELLED'
                            ? 'border-border-subtle opacity-70'
                            : 'border-border-subtle'
                        }`}
                      >
                        <div>
                          <p className="font-display text-[22px] leading-none text-ink-black">
                            {hhmm(b.start_time)}
                          </p>
                          <p className="font-ui text-[11px] text-text-tertiary mt-1">
                            to {hhmm(b.end_time)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-ui text-card-title font-bold text-ink-black truncate">
                            {b.turf_name}
                          </p>
                          <p className="font-ui text-body text-text-tertiary truncate">
                            {b.customer_name || 'Player'}
                            {b.customer_phone ? ` · ${b.customer_phone}` : ''}
                          </p>
                          {b.booking_status !== 'CANCELLED' && due > 0 && (
                            <div className="mt-2 flex items-center gap-3">
                              <div className="h-[5px] w-[140px] overflow-hidden rounded-[999px] bg-ink-black/[0.08]">
                                <motion.div
                                  className="h-full rounded-[999px] bg-brand-red"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.7, ease: EASE_OUT }}
                                />
                              </div>
                              <span className="font-ui text-[12px] text-text-secondary">
                                {formatRupees(paid)} of {formatRupees(due)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusPill
                            tone={BOOKING_TONE[b.booking_status] ?? 'neutral'}
                            label={b.booking_status}
                          />
                          <span className="font-ui text-body font-bold text-ink-black">
                            {formatRupees(b.booking_amount)}
                          </span>
                          <ChevronRight className="h-[18px] w-[18px] text-text-tertiary transition-transform duration-200 group-hover:translate-x-1 group-hover:text-brand-red" />
                        </div>
                      </motion.button>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.turf_name ?? 'Booking'}
        subtitle={open ? `Booking ${open.booking_id.slice(0, 8)}…` : undefined}
        testID="owner-booking-drawer"
      >
        {open && (
          <BookingDetail key={open.booking_id} booking={open} onChanged={() => load(true)} />
        )}
      </Drawer>
    </div>
  );
}
