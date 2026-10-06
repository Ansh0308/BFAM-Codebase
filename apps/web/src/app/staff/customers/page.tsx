'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarPlus, LifeBuoy, Phone, Search, UserSearch } from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import type { AvailabilitySlot, StaffAssignment, StaffCustomer } from '@bfam/shared-types';
import { apiClient } from '../../../lib/apiClient';
import { formatDay, formatRupees, hhmm, todayISO } from '../../../lib/dates';
import { PageHeader } from '../../../components/DashboardShell';
import { Drawer } from '../../../components/ui/Drawer';
import { EASE_OUT } from '../../../components/ui/motion';
import { Toggle } from '../../../components/ui/Toggle';
import { useToast } from '../../../components/ui/Toast';
import {
  Avatar,
  Button,
  EmptyState,
  SearchInput,
  SkeletonRows,
  StatusPill,
  type Tone,
} from '../../../components/ui/kit';

const BOOKING_TONE: Record<string, Tone> = {
  CONFIRMED: 'success',
  COMPLETED: 'info',
  PENDING: 'warning',
  CANCELLED: 'neutral',
};

const CATEGORIES = [
  { value: 'BOOKING_ISSUE', label: 'Booking' },
  { value: 'PAYMENT_ISSUE', label: 'Payment' },
  { value: 'MATCH_ISSUE', label: 'Match' },
  { value: 'ACCOUNT_ISSUE', label: 'Account' },
  { value: 'OTHER', label: 'Something else' },
];

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 h-[48px] font-ui text-[16px] text-text-primary focus:border-brand-red focus:outline-none focus:shadow-[0_0_0_4px_rgba(216,0,0,0.1)]';
const LABEL = 'font-ui text-micro uppercase tracking-wide text-text-secondary';

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

// Customer desk (SW-6, PRD §22.2): look a customer up by phone or BFAM ID, book
// a slot for someone who walked in (taking their cash on the spot), or log a
// complaint for them. Built for a phone at the counter: one column, big targets.
export default function StaffCustomersPage() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffCustomer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<StaffCustomer | null>(null);
  const [ticket, setTicket] = useState<StaffCustomer | null>(null);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);

  useEffect(() => {
    apiClient
      .getMyStaffAssignments()
      .then((res) =>
        setAssignments(
          res.results.filter((a) => a.status === 'ACTIVE' && a.verification_status === 'APPROVED'),
        ),
      )
      .catch(() => setAssignments([]));
  }, []);

  async function search() {
    const q = query.trim();
    if (q.length < 3) return setError('Type at least 3 characters of a phone number or a BFAM ID.');
    setError(null);
    setSearching(true);
    try {
      setResults((await apiClient.lookupStaffCustomers(q)).results);
    } catch (err) {
      setResults(null);
      setError(err instanceof BFAMApiError ? err.message : 'Could not search.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div data-testid="staff-customers-page">
      <PageHeader
        title="Customers"
        subtitle="Find a customer, book for a walk-in, or log a complaint."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSubmit={search}
            loading={searching}
            placeholder="Phone number or BFAM ID"
            ariaLabel="Find a customer"
            testID="customer-lookup"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          icon={Search}
          loading={searching}
          testID="lookup-go"
          className="w-full sm:w-auto"
        >
          Find
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          data-testid="lookup-error"
          className="mb-4 font-ui text-body text-brand-red"
        >
          {error}
        </p>
      )}

      {searching ? (
        <SkeletonRows rows={2} />
      ) : results === null ? (
        <EmptyState
          icon={UserSearch}
          title="Look someone up"
          message="Search by the number they signed up with, or their BFAM ID (like BF1001)."
          testID="lookup-idle"
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title="No customer found"
          message="They may not have a BFAM account yet — ask them to sign up in the app, then search again."
          testID="lookup-empty"
        />
      ) : (
        <ul className="space-y-4" data-testid="customer-results">
          {results.map((c, i) => (
            <motion.li
              key={c.user_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: EASE_OUT }}
              data-testid={`customer-${c.user_id}`}
              className="rounded-lg border border-border-subtle bg-surface p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center gap-3">
                <Avatar name={c.name || c.phone_number} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-ui text-card-title font-bold text-ink-black">
                    {c.name || c.phone_number}
                  </p>
                  <p className="font-ui text-body text-text-tertiary">
                    {c.phone_number}
                    {c.bfam_id ? ` · ${c.bfam_id}` : ''}
                  </p>
                </div>
                <a
                  href={`tel:${c.phone_number}`}
                  aria-label={`Call ${c.phone_number}`}
                  className="grid h-[44px] w-[44px] place-items-center rounded-md bg-brand-red/10 text-brand-red"
                >
                  <Phone className="h-[20px] w-[20px]" />
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  icon={CalendarPlus}
                  onClick={() => setBooking(c)}
                  testID={`book-${c.user_id}`}
                  className="w-full"
                >
                  Book a slot
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  icon={LifeBuoy}
                  onClick={() => setTicket(c)}
                  disabled={c.bookings_here === 0}
                  testID={`ticket-${c.user_id}`}
                  className="w-full"
                >
                  Log a complaint
                </Button>
              </div>
              {c.bookings_here === 0 && (
                <p className="mt-2 font-ui text-micro text-text-tertiary">
                  A complaint can be logged once they have booked at your turf.
                </p>
              )}

              {c.bookings.length > 0 && (
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <p className="mb-2 font-ui text-micro uppercase tracking-wide text-text-secondary">
                    Bookings at your turf
                  </p>
                  <ul className="space-y-2" data-testid={`history-${c.user_id}`}>
                    {c.bookings.slice(0, 5).map((b) => (
                      <li
                        key={b.booking_id}
                        className="flex items-center justify-between gap-3 rounded-md bg-ink-black/[0.03] px-3 py-2"
                      >
                        <div>
                          <p className="font-ui text-body font-semibold text-ink-black">
                            {b.turf_name}
                          </p>
                          <p className="font-ui text-micro text-text-tertiary">
                            {formatDay(b.booking_date)} · {hhmm(b.start_time)}–{hhmm(b.end_time)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-ui text-body font-semibold">
                            {formatRupees(b.booking_amount)}
                          </span>
                          <StatusPill
                            label={b.booking_status}
                            tone={BOOKING_TONE[b.booking_status] ?? 'neutral'}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.li>
          ))}
        </ul>
      )}

      <Drawer
        open={booking !== null}
        onClose={() => setBooking(null)}
        title="Book a slot"
        subtitle={booking ? booking.name || booking.phone_number : undefined}
        testID="walkin-drawer"
      >
        {booking && (
          <WalkInForm
            customer={booking}
            assignments={assignments}
            onBooked={(paid) => {
              toast.success(paid ? 'Booked and cash recorded' : 'Booked — payment still due');
              setBooking(null);
              search();
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={ticket !== null}
        onClose={() => setTicket(null)}
        title="Log a complaint"
        subtitle={ticket ? ticket.name || ticket.phone_number : undefined}
        testID="ticket-drawer"
      >
        {ticket && (
          <TicketForm
            customer={ticket}
            onRaised={() => {
              toast.success('Complaint logged for the BFAM team');
              setTicket(null);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

function WalkInForm({
  customer,
  assignments,
  onBooked,
}: {
  customer: StaffCustomer;
  assignments: StaffAssignment[];
  onBooked: (paid: boolean) => void;
}) {
  const turfs = useMemo(
    () => assignments.map((a) => ({ turf_id: a.turf_id, turf_name: a.turf_name ?? 'Turf' })),
    [assignments],
  );
  const [turfId, setTurfId] = useState(turfs[0]?.turf_id ?? '');
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [start, setStart] = useState('');
  const [hours, setHours] = useState(1);
  const [cash, setCash] = useState(true);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!turfId && turfs[0]) setTurfId(turfs[0].turf_id);
  }, [turfs, turfId]);

  useEffect(() => {
    if (!turfId || !date) return;
    let cancelled = false;
    setSlots(null);
    setStart('');
    apiClient
      .getTurfAvailability(turfId, date)
      .then((res) => !cancelled && setSlots(res.slots))
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [turfId, date]);

  const index = slots ? slots.findIndex((s) => s.start_time === start) : -1;
  const slotMinutes =
    slots && slots[0] ? minutes(slots[0].end_time) - minutes(slots[0].start_time) : 60;
  // How many slots in a row are free from the chosen start.
  const run = useMemo(() => {
    if (!slots || index < 0) return 0;
    let n = 0;
    while (slots[index + n] && slots[index + n].status === 'AVAILABLE') n += 1;
    return n;
  }, [slots, index]);
  const maxHours = Math.max(1, Math.floor((run * slotMinutes) / 60));
  const chosen =
    slots && index >= 0
      ? slots.slice(index, index + Math.max(1, Math.round((hours * 60) / slotMinutes)))
      : [];
  const total = chosen.reduce((sum, s) => sum + ((s.price_per_hour ?? 0) * slotMinutes) / 60, 0);

  useEffect(() => {
    if (hours > maxHours) setHours(maxHours);
  }, [hours, maxHours]);

  async function submit() {
    if (!turfId) return setError('You are not assigned to an approved turf.');
    if (!start) return setError('Pick a start time.');
    setError(null);
    setSaving(true);
    try {
      const res = await apiClient.createStaffWalkIn({
        turf_id: turfId,
        customer_user_id: customer.user_id,
        booking_date: date,
        start_time: start,
        duration_minutes: hours * 60,
        collect_cash: cash,
        cash_reference: reference.trim() || null,
      });
      onBooked(res.paid);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not make that booking.');
    } finally {
      setSaving(false);
    }
  }

  if (turfs.length === 0) {
    return (
      <p className="font-ui text-body text-text-tertiary" data-testid="walkin-no-turf">
        You need to be an approved staff member of a turf before you can book for customers.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="walkin-form"
    >
      {turfs.length > 1 && (
        <label className="mb-4 block">
          <span className={LABEL}>Turf</span>
          <select
            value={turfId}
            onChange={(e) => setTurfId(e.target.value)}
            data-testid="walkin-turf"
            className={FIELD}
          >
            {turfs.map((t) => (
              <option key={t.turf_id} value={t.turf_id}>
                {t.turf_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mb-4 block">
        <span className={LABEL}>Date</span>
        <input
          type="date"
          value={date}
          min={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          data-testid="walkin-date"
          className={FIELD}
        />
      </label>

      <div className="mb-4">
        <span className={LABEL}>Start time</span>
        {slots === null ? (
          <SkeletonRows rows={1} />
        ) : slots.length === 0 ? (
          <p className="mt-2 font-ui text-body text-text-tertiary" data-testid="walkin-no-slots">
            The turf has no slots that day.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="walkin-slots">
            {slots.map((s) => {
              const free = s.status === 'AVAILABLE';
              const active = s.start_time === start;
              return (
                <button
                  key={s.start_time}
                  type="button"
                  disabled={!free}
                  onClick={() => setStart(s.start_time)}
                  aria-pressed={active}
                  data-testid={`slot-${hhmm(s.start_time)}`}
                  className={`h-[48px] rounded-md font-ui text-[14px] font-bold cursor-pointer transition-colors ${
                    active
                      ? 'bg-brand-red text-white shadow-[0_6px_18px_rgba(216,0,0,0.28)]'
                      : free
                        ? 'bg-ink-black/[0.05] text-ink-black active:bg-ink-black/[0.12]'
                        : 'bg-ink-black/[0.03] text-text-tertiary line-through cursor-not-allowed'
                  }`}
                >
                  {hhmm(s.start_time)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {start && (
        <label className="mb-4 block">
          <span className={LABEL}>For how long</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            data-testid="walkin-hours"
            className={FIELD}
          >
            {Array.from({ length: Math.min(maxHours, 4) }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h} hour{h === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
      )}

      {start && (
        <div
          className="mb-4 flex items-center justify-between rounded-md bg-brand-red/[0.06] px-4 py-3"
          data-testid="walkin-total"
        >
          <span className="font-ui text-body text-text-secondary">Total</span>
          <span className="font-display text-[28px] leading-none text-brand-red">
            {formatRupees(total)}
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-md bg-ink-black/[0.04] px-4 py-3">
        <div>
          <p className="font-ui text-body font-semibold text-ink-black">Customer pays cash now</p>
          <p className="font-ui text-micro text-text-tertiary">
            Off = they pay later from the app.
          </p>
        </div>
        <Toggle
          checked={cash}
          onChange={setCash}
          label="Customer pays cash now"
          testID="walkin-cash"
        />
      </div>
      {cash && (
        <label className="mb-4 block">
          <span className={LABEL}>Receipt / note (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            data-testid="walkin-reference"
            className={FIELD}
          />
        </label>
      )}

      {error && (
        <p
          role="alert"
          data-testid="walkin-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="walkin-submit" className="w-full">
        {cash ? 'Book and record cash' : 'Book the slot'}
      </Button>
    </form>
  );
}

function TicketForm({ customer, onRaised }: { customer: StaffCustomer; onRaised: () => void }) {
  const [category, setCategory] = useState('BOOKING_ISSUE');
  const [description, setDescription] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (description.trim().length < 10)
      return setError('Describe what happened (at least 10 characters).');
    setError(null);
    setSaving(true);
    try {
      await apiClient.raiseStaffTicket(customer.user_id, {
        category,
        description: description.trim(),
        booking_id: bookingId || null,
      });
      onRaised();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not log the complaint.');
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
      data-testid="ticket-form"
    >
      <label className="mb-4 block">
        <span className={LABEL}>About</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          data-testid="ticket-category"
          className={FIELD}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {customer.bookings.length > 0 && (
        <label className="mb-4 block">
          <span className={LABEL}>Which booking? (optional)</span>
          <select
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            data-testid="ticket-booking"
            className={FIELD}
          >
            <option value="">Not about one booking</option>
            {customer.bookings.map((b) => (
              <option key={b.booking_id} value={b.booking_id}>
                {formatDay(b.booking_date)} {hhmm(b.start_time)} · {b.turf_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mb-5 block">
        <span className={LABEL}>What happened</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          data-testid="ticket-description"
          className={`${FIELD} h-auto py-3`}
        />
      </label>
      {error && (
        <p
          role="alert"
          data-testid="ticket-error"
          className="mb-4 rounded-md bg-status-danger-bg px-3 py-2 font-ui text-body text-status-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={saving} testID="ticket-submit" className="w-full">
        Log complaint
      </Button>
    </form>
  );
}
