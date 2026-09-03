import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { isUniqueConstraintError } from '../domain/dbErrors';
import { sequelize } from '../config/sequelize';
import {
  BookingNotFoundError,
  ForbiddenActionError,
  InvalidBookingStateError,
  InvalidSlotAlignmentError,
  NoPricingConfiguredError,
  OutsideOperatingHoursError,
  SlotBlockedError,
  SlotUnavailableError,
  TurfNotFoundError,
} from '../domain/errors';
import { SLOT_DURATION_MINUTES, resolveDayType } from './turfService';
import { refundPaymentsForBooking } from './paymentService';

export interface CreateBookingInput {
  turfId: string;
  bookedBy: string;
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
  paymentMode: string;
}

function toTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(time: string, minutes: number): string {
  const total = toTimeMinutes(time) + minutes;
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

// Creates a booking, enforcing PRD §15's "no double-booking" and "only
// available slots can be booked" rules. The database's composite unique
// constraint on (turf_id, booking_date, start_time) — added in Phase 1 as a
// generated column keyed on active (PENDING/CONFIRMED) bookings — is the
// authoritative, race-safe guarantee; every check performed here beforehand
// is purely for a fast, friendly error rather than a security boundary.
export async function createBooking(input: CreateBookingInput) {
  const { turfId, bookedBy, bookingDate, startTime, durationMinutes, paymentMode } = input;

  if (
    durationMinutes % SLOT_DURATION_MINUTES !== 0 ||
    toTimeMinutes(startTime) % SLOT_DURATION_MINUTES !== 0
  ) {
    throw new InvalidSlotAlignmentError();
  }

  const [turf] = await sequelize.query<{ turf_id: string }>(
    "SELECT turf_id FROM turfs WHERE turf_id = :turfId AND turf_status = 'ACTIVE' AND deleted_at IS NULL",
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (!turf) throw new TurfNotFoundError(turfId);

  const dayOfWeek = new Date(`${bookingDate}T00:00:00Z`).getUTCDay();
  const [hours] = await sequelize.query<{ open_time: string; close_time: string }>(
    'SELECT open_time, close_time FROM turf_operating_hours WHERE turf_id = :turfId AND day_of_week = :dayOfWeek',
    { type: QueryTypes.SELECT, replacements: { turfId, dayOfWeek } },
  );
  const endTime = addMinutesToTime(startTime, durationMinutes);
  if (
    !hours ||
    toTimeMinutes(startTime) < toTimeMinutes(hours.open_time) ||
    toTimeMinutes(endTime) > toTimeMinutes(hours.close_time)
  ) {
    throw new OutsideOperatingHoursError();
  }

  const blocks = await sequelize.query<{ start_datetime: string; end_datetime: string }>(
    `SELECT start_datetime, end_datetime FROM turf_availability_blocks
     WHERE turf_id = :turfId AND start_datetime < :slotEnd AND end_datetime > :slotStart`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        turfId,
        slotStart: `${bookingDate} ${startTime}`,
        slotEnd: `${bookingDate} ${endTime}`,
      },
    },
  );
  if (blocks.length > 0) throw new SlotBlockedError();

  const dayType = resolveDayType(bookingDate);
  const [pricing] = await sequelize.query<{ price_per_hour: string }>(
    `SELECT price_per_hour FROM turf_pricing
     WHERE turf_id = :turfId AND day_type = :dayType
       AND start_time <= :startTime AND end_time > :startTime
       AND effective_from <= :bookingDate AND (effective_to IS NULL OR effective_to >= :bookingDate)
     LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { turfId, dayType, startTime, bookingDate } },
  );
  if (!pricing) throw new NoPricingConfiguredError();

  const bookingAmount = Number(
    ((Number(pricing.price_per_hour) * durationMinutes) / 60).toFixed(2),
  );
  const now = new Date();
  const bookingId = randomUUID();

  try {
    await sequelize.getQueryInterface().bulkInsert('bookings', [
      {
        booking_id: bookingId,
        turf_id: turfId,
        booked_by: bookedBy,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        booking_amount: bookingAmount,
        // PENDING until the (separate, not-yet-built) Payments module
        // confirms payment — Booking Confirmation hands off to a payment
        // stub only, per this module's scope.
        booking_status: 'PENDING',
        payment_mode: paymentMode,
        cancellation_reason: null,
        cancelled_at: null,
        cancelled_by: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new SlotUnavailableError();
    }
    throw error;
  }

  return {
    booking_id: bookingId,
    turf_id: turfId,
    booked_by: bookedBy,
    booking_date: bookingDate,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    booking_amount: bookingAmount,
    booking_status: 'PENDING',
    payment_mode: paymentMode,
    created_at: now,
    updated_at: now,
  };
}

interface BookingRecord {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  booking_amount: string;
  booking_status: string;
  payment_mode: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listBookingsForUser(
  userId: string,
  scope: 'upcoming' | 'past' | 'all' = 'all',
) {
  const conditions = ['b.booked_by = :userId'];
  if (scope === 'upcoming')
    conditions.push("b.booking_date >= CURDATE() AND b.booking_status != 'CANCELLED'");
  if (scope === 'past')
    conditions.push("(b.booking_date < CURDATE() OR b.booking_status = 'CANCELLED')");

  return sequelize.query<BookingRecord & { turf_name: string; city: string }>(
    `SELECT b.*, t.turf_name, t.city
     FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY b.booking_date DESC, b.start_time DESC`,
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
}

async function fetchBooking(bookingId: string): Promise<BookingRecord | null> {
  const [booking] = await sequelize.query<BookingRecord>(
    'SELECT * FROM bookings WHERE booking_id = :bookingId',
    {
      type: QueryTypes.SELECT,
      replacements: { bookingId },
    },
  );
  return booking ?? null;
}

export async function getBookingById(bookingId: string, actor: { userId: string; role: string }) {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new BookingNotFoundError(bookingId);
  await assertCanViewOrManage(booking, actor);
  return booking;
}

async function assertCanViewOrManage(
  booking: BookingRecord,
  actor: { userId: string; role: string },
) {
  if (booking.booked_by === actor.userId || actor.role === 'ADMIN') return;
  if (actor.role === 'TURF_OWNER') {
    const [turf] = await sequelize.query<{ owner_id: string }>(
      'SELECT owner_id FROM turfs WHERE turf_id = :turfId',
      { type: QueryTypes.SELECT, replacements: { turfId: booking.turf_id } },
    );
    if (turf && turf.owner_id === actor.userId) return;
  }
  throw new ForbiddenActionError('You are not allowed to access this booking.');
}

export async function cancelBooking(
  bookingId: string,
  actor: { userId: string; role: string },
  cancellationReason: string | undefined,
) {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new BookingNotFoundError(bookingId);
  await assertCanViewOrManage(booking, actor);

  if (booking.booking_status === 'CANCELLED' || booking.booking_status === 'COMPLETED') {
    throw new InvalidBookingStateError(
      `Booking is already ${booking.booking_status.toLowerCase()} and cannot be cancelled.`,
    );
  }

  const now = new Date();
  await sequelize.getQueryInterface().bulkUpdate(
    'bookings',
    {
      booking_status: 'CANCELLED',
      cancellation_reason: cancellationReason ?? null,
      cancelled_at: now,
      cancelled_by: actor.userId,
      updated_at: now,
    },
    { booking_id: bookingId },
  );

  await sequelize.getQueryInterface().bulkInsert('audit_logs', [
    {
      log_id: randomUUID(),
      actor_user_id: actor.userId,
      actor_role: actor.role,
      action: 'BOOKING_CANCELLED',
      resource_type: 'booking',
      resource_id: bookingId,
      before_data: JSON.stringify({ booking_status: booking.booking_status }),
      after_data: JSON.stringify({
        booking_status: 'CANCELLED',
        cancellation_reason: cancellationReason ?? null,
      }),
      ip_address: null,
      request_id: null,
      created_at: now,
    },
  ]);

  // Module 2.4: refund whatever was already paid, per the cancellation-
  // timing policy (PRD §12.17). A refund-processing failure must never
  // block the cancellation itself — the booking is cancelled either way;
  // any refund that couldn't be completed is recorded FAILED in `refunds`
  // for manual follow-up rather than silently lost.
  try {
    await refundPaymentsForBooking(bookingId, now, actor.userId);
  } catch {
    // Deliberately swallowed — see comment above.
  }

  return {
    ...booking,
    booking_status: 'CANCELLED',
    cancellation_reason: cancellationReason ?? null,
    cancelled_at: now,
    cancelled_by: actor.userId,
  };
}
