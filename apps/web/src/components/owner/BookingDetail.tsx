'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Ban, CalendarClock, Phone, Swords, User } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type {
  BookingMatches,
  OwnerBookingRow,
  Payment,
  PaymentObligation,
} from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import { formatDay, formatRupees, hhmm } from '../../lib/dates';
import { Button, Skeleton, StatusPill, type Tone } from '../ui/kit';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { EASE_OUT } from '../ui/motion';

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

// The owner's view of one booking: who booked it, how it's being paid for,
// the matches played in the slot, and — while it can still be cancelled — the
// cancel action. Cancelling uses the same endpoint the player app does (the
// owner is allowed to manage bookings at their own turfs).
export function BookingDetail({
  booking,
  onChanged,
}: {
  booking: OwnerBookingRow;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [obligations, setObligations] = useState<PaymentObligation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [slot, setSlot] = useState<BookingMatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState(booking.booking_status);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, p, s] = await Promise.allSettled([
      apiClient.getObligations(booking.booking_id),
      apiClient.getBookingPayments(booking.booking_id),
      apiClient.getBookingMatches(booking.booking_id),
    ]);
    if (o.status === 'fulfilled') setObligations(o.value.results);
    if (p.status === 'fulfilled') setPayments(p.value.results);
    if (s.status === 'fulfilled') setSlot(s.value);
    setLoading(false);
  }, [booking.booking_id]);

  useEffect(() => {
    load();
  }, [load]);

  const due = Number(booking.amount_due);
  const paid = Number(booking.amount_paid);
  const paidPct = due === 0 ? 0 : Math.min(100, Math.round((paid / due) * 100));
  const cancellable = status === 'CONFIRMED' || status === 'PENDING';

  async function cancel(reason: string) {
    setCancelling(true);
    try {
      await apiClient.cancelBooking(booking.booking_id, reason || undefined);
      setStatus('CANCELLED');
      setConfirming(false);
      toast.success('Booking cancelled — the slot is free again');
      onChanged();
    } catch (err) {
      toast.error(err instanceof BFAMApiError ? err.message : 'Could not cancel the booking.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div data-testid="owner-booking-detail">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <StatusPill tone={BOOKING_TONE[status] ?? 'neutral'} label={status} />
        <span className="font-ui text-body text-text-secondary">
          {formatDay(booking.booking_date)} · {hhmm(booking.start_time)}–{hhmm(booking.end_time)} ·{' '}
          {booking.duration_minutes} min
        </span>
      </div>

      <section className="rounded-lg border border-border-subtle p-4 mb-5">
        <h3 className="font-ui text-micro uppercase tracking-wider text-text-tertiary mb-3">
          Customer
        </h3>
        <div className="flex items-center gap-3">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-[999px] bg-ink-black text-white">
            <User className="h-[20px] w-[20px]" />
          </span>
          <div className="min-w-0">
            <p className="font-ui text-card-title font-bold text-ink-black truncate">
              {booking.customer_name || 'Player'}
            </p>
            {booking.customer_phone ? (
              <a
                href={`tel:${booking.customer_phone}`}
                className="inline-flex items-center gap-1 font-ui text-body text-brand-red hover:underline"
                data-testid="customer-phone"
              >
                <Phone className="h-[14px] w-[14px]" /> {booking.customer_phone}
              </a>
            ) : (
              <p className="font-ui text-body text-text-tertiary">No phone on file</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-ink-black text-white p-5 mb-5 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-[120px] w-[120px] rounded-[999px] bg-brand-red/40"
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="font-ui text-micro uppercase tracking-wider text-white/60">Paid</p>
            <p className="font-display text-[36px] leading-none">
              {formatRupees(paid)}
              <span className="text-white/50 text-[20px]"> / {formatRupees(due)}</span>
            </p>
          </div>
          <StatusPill
            tone={due > 0 && paid >= due ? 'success' : 'warning'}
            label={
              due > 0 && paid >= due ? 'Settled' : `${formatRupees(Math.max(due - paid, 0))} due`
            }
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
      </section>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-[48px] w-full" />
          <Skeleton className="h-[48px] w-full" />
        </div>
      ) : (
        <>
          {obligations.length > 0 && (
            <section className="mb-5">
              <h3 className="font-ui text-micro uppercase tracking-wider text-text-tertiary mb-2">
                Payment shares
              </h3>
              <ul className="space-y-2">
                {obligations.map((o) => (
                  <li
                    key={o.obligation_id}
                    className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-[10px]"
                  >
                    <span className="font-ui text-body font-semibold text-ink-black">
                      {formatRupees(o.amount_due)}
                    </span>
                    <StatusPill
                      tone={OBLIGATION_TONE[o.due_status] ?? 'neutral'}
                      label={o.due_status.replace('_', ' ')}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {payments.length > 0 && (
            <section className="mb-5">
              <h3 className="font-ui text-micro uppercase tracking-wider text-text-tertiary mb-2">
                Payments
              </h3>
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li
                    key={p.payment_id}
                    className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-[10px]"
                  >
                    <span className="font-ui text-body text-ink-black">
                      {formatRupees(p.amount)}
                      <span className="ml-2 text-[12px] text-text-tertiary">
                        {p.payment_method}
                        {p.cash_reference ? ` · ${p.cash_reference}` : ''}
                      </span>
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
            </section>
          )}

          {slot && slot.matches.length > 0 && (
            <section className="mb-5">
              <h3 className="font-ui text-micro uppercase tracking-wider text-text-tertiary mb-2">
                Matches in this slot
              </h3>
              <ul className="space-y-2">
                {slot.matches.map((m) => (
                  <li
                    key={m.match_id}
                    className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-[10px]"
                  >
                    <span className="flex items-center gap-2 font-ui text-body text-ink-black">
                      <Swords className="h-[16px] w-[16px] text-brand-red" />
                      {m.match_name || 'Match'}
                    </span>
                    <StatusPill
                      tone={m.match_status === 'IN_PROGRESS' ? 'brand' : 'neutral'}
                      label={m.match_status.replace('_', ' ')}
                      pulse={m.match_status === 'IN_PROGRESS'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {booking.cancellation_reason ? (
        <p className="mb-5 flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger">
          <CalendarClock className="mt-[2px] h-[16px] w-[16px] shrink-0" />
          Cancelled: {booking.cancellation_reason}
        </p>
      ) : null}

      {cancellable && (
        <div className="border-t border-border-subtle pt-5">
          <Button
            variant="secondary"
            icon={Ban}
            onClick={() => setConfirming(true)}
            testID="cancel-booking"
          >
            Cancel booking
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Cancel this booking?"
        message={`This cancels ${formatDay(booking.booking_date)} ${hhmm(booking.start_time)}–${hhmm(booking.end_time)} at ${booking.turf_name} and frees the slot.`}
        confirmLabel="Cancel booking"
        reasonLabel="Reason (optional)"
        busy={cancelling}
        onCancel={() => setConfirming(false)}
        onConfirm={cancel}
        testID="cancel-dialog"
      />
    </div>
  );
}
