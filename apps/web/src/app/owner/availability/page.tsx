'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Percent,
  Wrench,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  AvailabilityBlockReason,
  AvailabilitySlot,
  OwnerBookingRow,
  Turf,
  TurfAvailability,
  TurfAvailabilityBlock,
} from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { addDays, formatDay, formatRupees, hhmm, todayISO } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { EASE_OUT } from '../../../components/ui/motion';
import { Button, EmptyState, SkeletonRows, StatTile } from '../../../components/ui/kit';

const REASONS: { value: AvailabilityBlockReason; label: string }[] = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'OWNER_BLOCK', label: 'Reserved by owner' },
];

// A slot's wall-clock time is compared with blocks as if it were UTC — the
// same convention the availability service uses, so a block made here lines
// up with the slot grid exactly.
function slotMs(date: string, time: string): number {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}.000Z`).getTime();
}

function slotEndMs(date: string, slot: AvailabilitySlot): number {
  const start = slotMs(date, slot.start_time);
  const end = slotMs(date, slot.end_time);
  return end <= start ? end + 86_400_000 : end;
}

function isoUtc(ms: number): string {
  return new Date(ms).toISOString();
}

// Availability Management (PRD §30.9): a day-by-day view of every slot at a
// pitch — open, booked (and by whom) or blocked — where the owner can block
// slots for maintenance/holidays or lift an existing block.
export default function OwnerAvailabilityPage() {
  const toast = useToast();
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [weekStart, setWeekStart] = useState(todayISO());
  const [availability, setAvailability] = useState<TurfAvailability | null>(null);
  const [blocks, setBlocks] = useState<TurfAvailabilityBlock[]>([]);
  const [bookings, setBookings] = useState<OwnerBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<AvailabilityBlockReason>('MAINTENANCE');
  const [saving, setSaving] = useState(false);
  const [unblock, setUnblock] = useState<TurfAvailabilityBlock | null>(null);

  useEffect(() => {
    apiClient
      .getMyTurfs()
      .then((res) => {
        setTurfs(res.results);
        setTurfId((prev) => prev || res.results[0]?.turf_id || '');
        if (res.results.length === 0) setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!turfId) return;
    setLoading(true);
    setSelected(new Set());
    const [a, b, k] = await Promise.allSettled([
      apiClient.getTurfAvailability(turfId, date),
      apiClient.listAvailabilityBlocks(turfId),
      apiClient.getOwnerBookings({ from: date, to: date, turf_id: turfId }),
    ]);
    setAvailability(a.status === 'fulfilled' ? a.value : null);
    setBlocks(b.status === 'fulfilled' ? b.value.results : []);
    setBookings(k.status === 'fulfilled' ? k.value.results : []);
    setLoading(false);
  }, [turfId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const slots = availability?.slots ?? [];
  const open = slots.filter((s) => s.status === 'AVAILABLE').length;
  const booked = slots.filter((s) => s.status === 'BOOKED').length;
  const blocked = slots.filter((s) => s.status === 'BLOCKED').length;
  const sellable = slots.length - blocked;
  const utilization = sellable > 0 ? Math.round((booked / sellable) * 100) : 0;

  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  function bookingFor(slot: AvailabilitySlot): OwnerBookingRow | undefined {
    return bookings.find(
      (b) => b.booking_status !== 'CANCELLED' && hhmm(b.start_time) === hhmm(slot.start_time),
    );
  }

  function blockFor(slot: AvailabilitySlot): TurfAvailabilityBlock | undefined {
    const s = slotMs(date, slot.start_time);
    const e = slotEndMs(date, slot);
    return blocks.find(
      (b) => s < new Date(b.end_datetime).getTime() && e > new Date(b.start_datetime).getTime(),
    );
  }

  function toggle(slot: AvailabilitySlot) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot.start_time)) next.delete(slot.start_time);
      else next.add(slot.start_time);
      return next;
    });
  }

  async function blockSelected() {
    const chosen = slots
      .filter((s) => selected.has(s.start_time))
      .sort((a, b) => slotMs(date, a.start_time) - slotMs(date, b.start_time));
    if (chosen.length === 0) return;
    // Merge back-to-back slots into one block each.
    const runs: { start: number; end: number }[] = [];
    for (const s of chosen) {
      const start = slotMs(date, s.start_time);
      const end = slotEndMs(date, s);
      const last = runs[runs.length - 1];
      if (last && last.end === start) last.end = end;
      else runs.push({ start, end });
    }
    setSaving(true);
    try {
      for (const run of runs) {
        // Sequential keeps the failure mode simple: stop at the first error.
        await apiClient.createAvailabilityBlock(turfId, {
          start_datetime: isoUtc(run.start),
          end_datetime: isoUtc(run.end),
          reason,
        });
      }
      toast.success(`${chosen.length} slot${chosen.length === 1 ? '' : 's'} blocked`);
      await load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not block those slots.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function lift(block: TurfAvailabilityBlock) {
    setSaving(true);
    try {
      await apiClient.removeAvailabilityBlock(block.block_id);
      toast.success('Block removed — slots are open again');
      setUnblock(null);
      await load();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not remove that block.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="owner-availability-page">
      <PageHeader
        title="Availability"
        subtitle="See every slot at a glance. Select open slots to block them; tap a blocked slot to open it again."
      />

      {turfs.length === 0 && !loading ? (
        <EmptyState
          icon={CalendarCheck}
          title="No turfs yet"
          message="Create a turf first, then manage its slots here."
          testID="availability-no-turfs"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <select
              value={turfId}
              onChange={(e) => setTurfId(e.target.value)}
              aria-label="Choose turf"
              data-testid="availability-turf"
              className="h-[44px] min-w-[220px] rounded-md border border-border-strong bg-surface px-3 font-ui text-body font-semibold text-text-primary cursor-pointer hover:border-text-tertiary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]"
            >
              {turfs.map((t) => (
                <option key={t.turf_id} value={t.turf_id}>
                  {t.turf_name}
                </option>
              ))}
            </select>
            <Button
              variant="soft"
              onClick={() => {
                setDate(todayISO());
                setWeekStart(todayISO());
              }}
              testID="availability-today"
            >
              Today
            </Button>
          </div>

          <div className="mb-7 flex items-stretch gap-2">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              aria-label="Previous week"
              className="grid w-[40px] place-items-center rounded-md border border-border-strong bg-surface text-text-secondary hover:border-brand-red hover:text-brand-red transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <div className="grid flex-1 grid-cols-7 gap-2" role="tablist" aria-label="Days">
              {week.map((d) => {
                const active = d === date;
                return (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDate(d)}
                    data-testid={`day-${d}`}
                    className={`relative rounded-lg border px-2 py-3 text-center cursor-pointer transition-colors duration-200 ${
                      active
                        ? 'border-transparent text-white'
                        : 'border-border-subtle bg-surface text-text-secondary hover:border-brand-red hover:text-brand-red'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="day-active"
                        className="absolute inset-0 rounded-lg bg-brand-red shadow-[0_8px_22px_rgba(216,0,0,0.32)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative block font-ui text-[11px] uppercase tracking-wider">
                      {formatDay(d, { weekday: 'short' })}
                    </span>
                    <span className="relative block font-display text-[26px] leading-none mt-1">
                      {Number(d.slice(8, 10))}
                    </span>
                    {d === todayISO() && (
                      <span
                        className={`relative mt-1 block font-ui text-[10px] ${active ? 'text-white/80' : 'text-brand-red'}`}
                      >
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              aria-label="Next week"
              className="grid w-[40px] place-items-center rounded-md border border-border-strong bg-surface text-text-secondary hover:border-brand-red hover:text-brand-red transition-colors cursor-pointer"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
            <StatTile
              label="Open slots"
              value={open}
              icon={CalendarCheck}
              delay={0.05}
              hint="Ready to book"
            />
            <StatTile
              label="Booked"
              value={booked}
              icon={Lock}
              tone="brand"
              delay={0.1}
              hint="Taken today"
            />
            <StatTile
              label="Blocked"
              value={blocked}
              icon={Wrench}
              delay={0.15}
              hint="Maintenance & holds"
            />
            <StatTile
              label="Utilisation"
              value={utilization}
              suffix="%"
              icon={Percent}
              delay={0.2}
              hint="Booked of sellable"
            />
          </div>

          {loading ? (
            <SkeletonRows rows={4} />
          ) : slots.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No slots this day"
              message="This turf has no operating hours for the selected day."
              testID="availability-empty"
            />
          ) : (
            <ul
              className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
              data-testid="slot-grid"
            >
              {slots.map((slot, index) => {
                const b = slot.status === 'BOOKED' ? bookingFor(slot) : undefined;
                const block = slot.status === 'BLOCKED' ? blockFor(slot) : undefined;
                const isSelected = selected.has(slot.start_time);
                return (
                  <motion.li
                    key={slot.start_time}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(index, 14) * 0.03,
                      ease: EASE_OUT,
                    }}
                  >
                    <motion.button
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      data-testid={`slot-${slot.start_time.slice(0, 5)}`}
                      aria-label={`${hhmm(slot.start_time)} to ${hhmm(slot.end_time)} ${slot.status.toLowerCase()}`}
                      onClick={() => {
                        if (slot.status === 'AVAILABLE') toggle(slot);
                        else if (slot.status === 'BLOCKED' && block) setUnblock(block);
                      }}
                      disabled={slot.status === 'BOOKED'}
                      className={`relative h-[104px] w-full overflow-hidden rounded-lg border p-3 text-left transition-shadow duration-300 ${
                        slot.status === 'BOOKED'
                          ? 'cursor-default border-brand-red/30 bg-brand-red/[0.07]'
                          : slot.status === 'BLOCKED'
                            ? 'cursor-pointer border-border-strong bg-[repeating-linear-gradient(135deg,#f3f3f3,#f3f3f3_8px,#ebebeb_8px,#ebebeb_16px)] hover:shadow-[0_10px_24px_rgba(0,0,0,0.1)]'
                            : isSelected
                              ? 'cursor-pointer border-brand-red bg-surface shadow-[0_0_0_3px_rgba(216,0,0,0.15)]'
                              : 'cursor-pointer border-border-subtle bg-surface hover:border-brand-red/50 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]'
                      }`}
                    >
                      <p className="font-display text-[22px] leading-none text-ink-black">
                        {hhmm(slot.start_time)}
                        <span className="text-text-tertiary text-[14px]">
                          {' '}
                          – {hhmm(slot.end_time)}
                        </span>
                      </p>
                      <div className="mt-2 font-ui text-[12px]">
                        {slot.status === 'AVAILABLE' && (
                          <p
                            className={
                              isSelected ? 'font-bold text-brand-red' : 'text-text-tertiary'
                            }
                          >
                            {isSelected
                              ? 'Selected to block'
                              : slot.price_per_hour != null
                                ? `${formatRupees(slot.price_per_hour)}/hr · open`
                                : 'Open'}
                          </p>
                        )}
                        {slot.status === 'BOOKED' && (
                          <>
                            <p className="font-bold text-brand-red flex items-center gap-1">
                              <Lock className="h-[12px] w-[12px]" /> Booked
                            </p>
                            <p className="text-text-secondary truncate">
                              {b?.customer_name || b?.customer_phone || 'Player'}
                            </p>
                          </>
                        )}
                        {slot.status === 'BLOCKED' && (
                          <>
                            <p className="font-bold text-text-secondary flex items-center gap-1">
                              <LockOpen className="h-[12px] w-[12px]" /> Blocked
                            </p>
                            <p className="text-text-tertiary">
                              {block
                                ? (REASONS.find((r) => r.value === block.reason)?.label ??
                                  block.reason)
                                : ''}{' '}
                              · tap to open
                            </p>
                          </>
                        )}
                      </div>
                    </motion.button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-ink-black px-5 py-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
            data-testid="block-bar"
          >
            <p className="font-ui text-body font-semibold">
              {selected.size} slot{selected.size === 1 ? '' : 's'} selected
            </p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as AvailabilityBlockReason)}
              aria-label="Reason for blocking"
              data-testid="block-reason"
              className="h-[38px] rounded-md border border-white/20 bg-white/10 px-3 font-ui text-body text-white focus:outline-none focus:border-brand-red"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value} className="text-ink-black">
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              icon={Lock}
              loading={saving}
              onClick={blockSelected}
              testID="block-selected"
            >
              Block
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="font-ui text-[13px] font-semibold text-white/70 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={unblock !== null}
        title="Open these slots again?"
        message={
          unblock
            ? `This removes the ${REASONS.find((r) => r.value === unblock.reason)?.label.toLowerCase() ?? 'block'} from ${new Date(unblock.start_datetime).toUTCString().slice(5, 22)} to ${new Date(unblock.end_datetime).toUTCString().slice(17, 22)}, so players can book them.`
            : ''
        }
        confirmLabel="Open slots"
        cancelLabel="Keep blocked"
        busy={saving}
        onCancel={() => setUnblock(null)}
        onConfirm={() => unblock && lift(unblock)}
        testID="unblock-dialog"
      />
    </div>
  );
}
