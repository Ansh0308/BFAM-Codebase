'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarX2,
  ChevronRight,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Timer,
  Users,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { OwnerBooking, OwnerMatch, StaffAssignment } from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { PageHeader } from '../../components/DashboardShell';
import { BookingDesk, BOOKING_TONE, hhmm } from '../../components/staff/BookingDesk';
import { Drawer } from '../../components/ui/Drawer';
import { FadeIn, EASE_OUT } from '../../components/ui/motion';
import { useToast } from '../../components/ui/Toast';
import {
  Button,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  StatTile,
  StatusPill,
} from '../../components/ui/kit';

type Phase = 'now' | 'upcoming' | 'done';
type Filter = 'all' | Phase;

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function phaseOf(b: OwnerBooking, now: Date): Phase {
  if (b.booking_status === 'CANCELLED' || b.booking_status === 'COMPLETED') return 'done';
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin >= minutes(b.end_time)) return 'done';
  if (nowMin >= minutes(b.start_time)) return 'now';
  return 'upcoming';
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Staff Web — Today's Desk (module 2.12, PRD §9.3 / §22.3). The desk-based
// alternative to Staff Mobile: every booking at the staff member's turf(s)
// today, and from each one the check-in roster, cash collection and details.
// All actions call the same endpoints Staff Mobile uses; the server refuses
// check-in and cash from staff the owner hasn't verified yet.
export default function StaffBookingsPage() {
  const toast = useToast();
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [matches, setMatches] = useState<OwnerMatch[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<OwnerBooking | null>(null);
  const [lookup, setLookup] = useState('');
  const [looking, setLooking] = useState(false);
  const now = useMemo(() => new Date(), [bookings]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [b, m, a] = await Promise.allSettled([
      apiClient.getStaffTodaysBookings(),
      apiClient.getStaffMatches(),
      apiClient.getMyStaffAssignments(),
    ]);
    setBookings(b.status === 'fulfilled' ? b.value.results : []);
    setMatches(m.status === 'fulfilled' ? m.value.results : []);
    setAssignments(a.status === 'fulfilled' ? a.value.results : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // null = still loading; the desk stays usable meanwhile and the server is
  // the real gate either way.
  const verified =
    assignments === null
      ? null
      : assignments.some((x) => x.status === 'ACTIVE' && x.verification_status === 'APPROVED');

  const phases = useMemo(
    () => bookings.map((b) => ({ booking: b, phase: phaseOf(b, now) })),
    [bookings, now],
  );
  const counts = {
    now: phases.filter((p) => p.phase === 'now').length,
    upcoming: phases.filter((p) => p.phase === 'upcoming').length,
    done: phases.filter((p) => p.phase === 'done').length,
  };
  const liveMatches = matches.filter((m) => m.match_status === 'IN_PROGRESS').length;
  const visible = phases.filter((p) => filter === 'all' || p.phase === filter);

  async function lookupBooking() {
    const id = lookup.trim();
    if (!id) return;
    setLooking(true);
    try {
      const found = await apiClient.getBookingDetails(id);
      setOpen({ ...found, turf_name: found.turf_name ?? 'Booking' });
      setLookup('');
    } catch (err) {
      toast.error(
        err instanceof BFAMApiError && err.status === 404
          ? 'No booking found with that ID.'
          : err instanceof BFAMApiError
            ? err.message
            : 'Could not look that booking up.',
      );
    } finally {
      setLooking(false);
    }
  }

  return (
    <div data-testid="staff-bookings-page">
      <PageHeader
        title="Today's Desk"
        subtitle="Check players in, collect cash and keep every slot on schedule."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => load(true)}
            testID="desk-refresh"
          >
            Refresh
          </Button>
        }
      />

      <FadeIn>
        <div className="bfam-hero relative overflow-hidden rounded-lg px-7 py-6 text-white mb-6 shadow-[0_18px_40px_rgba(216,0,0,0.25)]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-white/10 animate-sheen"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -bottom-16 font-display text-[180px] leading-none text-white/[0.07] animate-drift-x select-none"
          >
            BFAM
          </span>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-ui text-micro uppercase tracking-[0.2em] text-white/70">
                {greeting(new Date())}
              </p>
              <p className="font-display text-[34px] leading-tight tracking-wide uppercase">
                {loading
                  ? 'Loading your desk'
                  : bookings.length === 0
                    ? 'A quiet day at the turf'
                    : `${bookings.length} booking${bookings.length === 1 ? '' : 's'} on your desk`}
              </p>
            </div>
            <VerificationBadge verified={verified} />
          </div>
        </div>
      </FadeIn>

      {verified === false && (
        <FadeIn delay={0.05}>
          <Link
            href="/staff/verification"
            className="group mb-6 flex items-center gap-3 rounded-lg border border-brand-red/30 bg-brand-red/[0.05] px-4 py-3 transition-colors hover:bg-brand-red/[0.09]"
            data-testid="verification-banner"
          >
            <ShieldAlert className="h-[20px] w-[20px] text-brand-red shrink-0" />
            <span className="font-ui text-body text-ink-black flex-1">
              <strong>Verification pending.</strong> You can browse the desk, but check-in and cash
              collection unlock once the owner approves your ID.
            </span>
            <ArrowRight className="h-[18px] w-[18px] text-brand-red transition-transform group-hover:translate-x-1" />
          </Link>
        </FadeIn>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        <StatTile
          label="Bookings today"
          value={bookings.length}
          icon={Users}
          delay={0.05}
          tone="brand"
          hint="Across your turfs"
        />
        <StatTile
          label="In progress"
          value={counts.now}
          icon={Timer}
          delay={0.1}
          hint="Slots running now"
        />
        <StatTile
          label="Coming up"
          value={counts.upcoming}
          icon={CalendarX2}
          delay={0.15}
          hint="Still to arrive"
        />
        <StatTile
          label="Live matches"
          value={liveMatches}
          icon={Swords}
          delay={0.2}
          hint="Being scored now"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <SegmentedControl<Filter>
          testIDPrefix="desk-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: bookings.length },
            { value: 'now', label: 'Now', count: counts.now },
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'done', label: 'Done', count: counts.done },
          ]}
        />
        <div className="w-full max-w-[380px]">
          <SearchInput
            value={lookup}
            onChange={setLookup}
            onSubmit={lookupBooking}
            loading={looking}
            placeholder="Verify a booking — paste its ID"
            ariaLabel="Look up a booking by ID"
            testID="booking-lookup"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={bookings.length === 0 ? 'No bookings today' : 'Nothing here'}
          message={
            bookings.length === 0
              ? 'No bookings today at your assigned turf(s).'
              : 'No bookings match this filter right now.'
          }
          testID="desk-empty"
        />
      ) : (
        <ol className="relative space-y-3" data-testid="desk-list">
          <span aria-hidden className="absolute left-[69px] top-2 bottom-2 w-px bg-border-strong" />
          <AnimatePresence initial>
            {visible.map(({ booking: b, phase }, index) => (
              <motion.li
                key={b.booking_id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index, 10) * 0.05, ease: EASE_OUT }}
                className="relative flex items-stretch gap-5"
                data-testid={`desk-booking-${b.booking_id}`}
              >
                <div className="w-[56px] shrink-0 pt-4 text-right">
                  <p className="font-display text-[20px] leading-none text-ink-black">
                    {hhmm(b.start_time)}
                  </p>
                  <p className="font-ui text-[11px] text-text-tertiary mt-1">{hhmm(b.end_time)}</p>
                </div>
                <span className="relative z-[1] mt-[22px] grid h-[11px] w-[11px] shrink-0 place-items-center">
                  {phase === 'now' && (
                    <span className="absolute inset-0 rounded-[999px] bg-brand-red animate-pulse-ring" />
                  )}
                  <span
                    className={`h-[11px] w-[11px] rounded-[999px] border-2 border-surface-alt ${
                      phase === 'now'
                        ? 'bg-brand-red'
                        : phase === 'done'
                          ? 'bg-border-strong'
                          : 'bg-ink-black'
                    }`}
                  />
                </span>

                <motion.button
                  type="button"
                  onClick={() => setOpen(b)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.995 }}
                  className={`group flex-1 text-left rounded-lg border bg-surface px-5 py-4 cursor-pointer transition-shadow duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.09)] ${
                    phase === 'now'
                      ? 'border-brand-red/40 shadow-[0_8px_26px_rgba(216,0,0,0.12)]'
                      : 'border-border-subtle'
                  } ${phase === 'done' ? 'opacity-75' : ''}`}
                  aria-label={`Open desk for ${b.turf_name} at ${hhmm(b.start_time)}`}
                  data-testid={`open-desk-${b.booking_id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-ui text-card-title font-bold text-ink-black truncate">
                        {b.turf_name}
                      </p>
                      <p className="font-ui text-body text-text-tertiary mt-[2px]">
                        {hhmm(b.start_time)}–{hhmm(b.end_time)} · {b.duration_minutes} min · ₹
                        {Number(b.booking_amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {phase === 'now' && <StatusPill tone="brand" label="Live now" pulse />}
                      <StatusPill
                        tone={BOOKING_TONE[b.booking_status] ?? 'neutral'}
                        label={b.booking_status}
                      />
                      <span className="inline-flex items-center gap-1 font-ui text-[13px] font-bold text-brand-red">
                        Open desk
                        <ChevronRight className="h-[16px] w-[16px] transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </motion.button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.turf_name ?? 'Booking'}
        subtitle={
          open
            ? `${open.booking_date.slice(0, 10)} · ${hhmm(open.start_time)}–${hhmm(open.end_time)}`
            : undefined
        }
        testID="booking-drawer"
      >
        {open && <BookingDesk key={open.booking_id} booking={open} canAct={verified !== false} />}
      </Drawer>
    </div>
  );
}

function VerificationBadge({ verified }: { verified: boolean | null }) {
  if (verified === null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-[999px] bg-white/15 px-4 h-[36px] font-ui text-[12px] font-bold uppercase tracking-wide">
        <Radio className="h-[15px] w-[15px] animate-pulse" /> Checking access
      </span>
    );
  }
  return verified ? (
    <span
      className="inline-flex items-center gap-2 rounded-[999px] bg-white px-4 h-[36px] font-ui text-[12px] font-bold uppercase tracking-wide text-brand-red"
      data-testid="verified-badge"
    >
      <ShieldCheck className="h-[16px] w-[16px]" /> Verified staff
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-2 rounded-[999px] bg-ink-black/40 px-4 h-[36px] font-ui text-[12px] font-bold uppercase tracking-wide"
      data-testid="unverified-badge"
    >
      <ShieldAlert className="h-[16px] w-[16px]" /> Verification pending
    </span>
  );
}
