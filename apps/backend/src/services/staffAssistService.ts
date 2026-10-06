import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { createBooking } from './bookingService';
import { createObligationsForBooking, recordCashPayment } from './paymentService';
import { createComplaint, type CreateComplaintInput } from './supportService';
import { assertStaffVerified, recordStaffActivity } from './staffService';
import { assertBookingsOpen } from './settingsService';

// Staff Web — Customer assistance (SW-6, PRD §22.2): at the desk a staff member
// can look a customer up, make a booking for someone who walked in (taking their
// cash if they pay on the spot) and log a complaint on their behalf. Everything
// is limited to the turf(s) the staff member is assigned to and is recorded in
// their activity log.

export class StaffAssistError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'StaffAssistError';
  }
}

const q = <T extends object>(sql: string, replacements: Record<string, unknown> = {}) =>
  sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements });

async function myTurfIds(staffUserId: string): Promise<string[]> {
  const rows = await q<{ turf_id: string }>(
    `SELECT a.turf_id FROM turf_staff_assignments a JOIN turfs t ON t.turf_id = a.turf_id
     WHERE a.staff_user_id = :staffUserId AND a.status = 'ACTIVE' AND t.deleted_at IS NULL`,
    { staffUserId },
  );
  return rows.map((r) => r.turf_id);
}

export interface CustomerBookingRow {
  booking_id: string;
  turf_id: string;
  turf_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_amount: number;
  booking_status: string;
  payment_mode: string;
}

export interface LookedUpCustomer {
  user_id: string;
  name: string | null;
  phone_number: string;
  bfam_id: string | null;
  bookings_here: number;
  bookings: CustomerBookingRow[];
}

// Find players by phone number (any part of it) or BFAM ID.
export async function lookupCustomers(
  staffUserId: string,
  query: string,
): Promise<LookedUpCustomer[]> {
  await assertStaffVerified(staffUserId);
  const term = query.trim();
  if (term.length < 3) throw new StaffAssistError('Type at least 3 characters.', 400);
  const turfIds = await myTurfIds(staffUserId);
  if (turfIds.length === 0) return [];

  const isBfamId = /^bf\d+$/i.test(term);
  const users = await q<{
    user_id: string;
    name: string | null;
    phone_number: string;
    bfam_id: string | null;
  }>(
    `SELECT u.user_id, pl.full_name AS name, u.phone_number, u.bfam_id
     FROM users u LEFT JOIN players pl ON pl.user_id = u.user_id
     WHERE u.role = 'PLAYER' AND u.account_status = 'ACTIVE' AND u.deleted_at IS NULL
       AND ${isBfamId ? 'u.bfam_id = :bfam' : 'u.phone_number LIKE :phone'}
     ORDER BY u.created_at DESC LIMIT 5`,
    isBfamId ? { bfam: term.toUpperCase() } : { phone: `%${term.replace(/\s+/g, '')}%` },
  );

  const out: LookedUpCustomer[] = [];
  for (const u of users) {
    const bookings = await q<CustomerBookingRow>(
      `SELECT b.booking_id, b.turf_id, t.turf_name, b.booking_date, b.start_time, b.end_time,
              b.booking_amount, b.booking_status, b.payment_mode
       FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
       WHERE b.booked_by = :userId AND b.turf_id IN (:turfIds)
       ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 20`,
      { userId: u.user_id, turfIds },
    );
    out.push({
      ...u,
      bookings_here: bookings.length,
      bookings: bookings.map((b) => ({
        ...b,
        booking_date:
          typeof b.booking_date === 'string'
            ? b.booking_date.slice(0, 10)
            : new Date(b.booking_date).toISOString().slice(0, 10),
        booking_amount: Number(b.booking_amount),
      })),
    });
  }
  await recordStaffActivity(staffUserId, 'STAFF_CUSTOMER_LOOKUP', 'lookup', null, {
    matches: out.length,
  });
  return out;
}

export interface WalkInInput {
  turf_id: string;
  customer_user_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  collect_cash: boolean;
  cash_reference?: string | null;
}

// Books a slot for a customer who walked in. The booking is the customer's, in
// their account, exactly as if they had made it in the app. If they pay on the
// spot, the cash is recorded now and the booking is confirmed.
export async function createWalkInBooking(staffUserId: string, input: WalkInInput) {
  await assertBookingsOpen();
  await assertStaffVerified(staffUserId, input.collect_cash ? 'collect_cash' : undefined);
  if (!(await myTurfIds(staffUserId)).includes(input.turf_id)) {
    throw new StaffAssistError('You are not assigned to this turf.', 403);
  }
  const [customer] = await q<{ user_id: string }>(
    `SELECT user_id FROM users WHERE user_id = :userId AND role = 'PLAYER'
       AND account_status = 'ACTIVE' AND deleted_at IS NULL`,
    { userId: input.customer_user_id },
  );
  if (!customer) throw new StaffAssistError('That customer was not found.', 404);

  const booking = await createBooking({
    turfId: input.turf_id,
    bookedBy: customer.user_id,
    bookingDate: input.booking_date,
    startTime: input.start_time,
    durationMinutes: input.duration_minutes,
    paymentMode: 'CASH',
  });
  const obligations = await createObligationsForBooking(booking.booking_id, customer.user_id);

  let paid = false;
  if (input.collect_cash) {
    await recordCashPayment(
      obligations.map((o) => o.obligation_id),
      customer.user_id,
      staffUserId,
      input.cash_reference ?? undefined,
    );
    paid = true;
  }
  await recordStaffActivity(
    staffUserId,
    'STAFF_WALK_IN_BOOKING',
    booking.booking_id,
    input.turf_id,
    {
      amount: booking.booking_amount,
      paid,
    },
  );
  return { booking, paid };
}

export interface StaffTicketInput {
  customer_user_id: string;
  category: CreateComplaintInput['category'];
  description: string;
  booking_id?: string | null;
}

// A complaint logged for a customer, who sees it in their own support list.
export async function raiseTicketForCustomer(staffUserId: string, input: StaffTicketInput) {
  await assertStaffVerified(staffUserId);
  const turfIds = await myTurfIds(staffUserId);
  const [known] = turfIds.length
    ? await q<{ n: number | string }>(
        'SELECT COUNT(*) AS n FROM bookings WHERE booked_by = :userId AND turf_id IN (:turfIds)',
        { userId: input.customer_user_id, turfIds },
      )
    : [{ n: 0 }];
  if (Number(known?.n ?? 0) === 0) {
    throw new StaffAssistError(
      'You can only raise a ticket for a customer who has booked at your turf.',
      403,
    );
  }
  const [staff] = await q<{ phone_number: string }>(
    'SELECT phone_number FROM users WHERE user_id = :staffUserId',
    { staffUserId },
  );
  const ticket = await createComplaint(input.customer_user_id, {
    category: input.category,
    description: `Raised at the turf desk by staff (${staff?.phone_number ?? 'unknown'}): ${input.description}`,
    relatedEntityType: input.booking_id ? 'booking' : null,
    relatedEntityId: input.booking_id ?? null,
  });
  await recordStaffActivity(staffUserId, 'STAFF_TICKET_RAISED', input.customer_user_id, null, {
    category: input.category,
  });
  return ticket;
}
