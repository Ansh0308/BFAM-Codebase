import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Owner Web — Customers (OW-5, PRD §9.2). A "customer" is a player who has
// booked at one of the owner's turfs. The owner sees only what they already
// see on their bookings — name, phone, and what the person has booked, paid
// and missed at THEIR turfs — never email, address or activity elsewhere.

export class CustomerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CustomerError';
  }
}

export type CustomerSegment = 'NEW' | 'REGULAR' | 'LAPSED' | 'OCCASIONAL';

export interface CustomerRow {
  user_id: string;
  name: string | null;
  phone_number: string;
  visits: number;
  cancelled: number;
  no_shows: number;
  total_spend: number;
  first_booking: string | null;
  last_booking: string | null;
  segment: CustomerSegment;
}

const DAY_MS = 86_400_000;

// NEW: first booking in the last 30 days. REGULAR: 3+ visits and one in the
// last 60 days. LAPSED: nothing for 60+ days. Everyone else is OCCASIONAL.
export function segmentFor(
  visits: number,
  firstBooking: string | null,
  lastBooking: string | null,
  today: Date = new Date(),
): CustomerSegment {
  const daysSince = (iso: string | null) =>
    iso
      ? Math.floor((today.getTime() - new Date(`${iso.slice(0, 10)}T00:00:00`).getTime()) / DAY_MS)
      : Infinity;
  if (daysSince(firstBooking) <= 30) return 'NEW';
  if (visits >= 3 && daysSince(lastBooking) <= 60) return 'REGULAR';
  if (daysSince(lastBooking) > 60) return 'LAPSED';
  return 'OCCASIONAL';
}

const dateStr = (v: unknown): string | null =>
  v == null
    ? null
    : typeof v === 'string'
      ? v.slice(0, 10)
      : new Date(v as Date).toISOString().slice(0, 10);

export async function listCustomers(
  ownerId: string,
  filters: { turfId?: string; search?: string; segment?: CustomerSegment } = {},
): Promise<CustomerRow[]> {
  const replacements: Record<string, unknown> = { ownerId };
  let extra = '';
  if (filters.turfId) {
    extra += ' AND b.turf_id = :turfId';
    replacements.turfId = filters.turfId;
  }
  if (filters.search?.trim()) {
    extra += ' AND (pl.full_name LIKE :search OR u.phone_number LIKE :search)';
    replacements.search = `%${filters.search.trim()}%`;
  }

  const rows = await sequelize.query<{
    user_id: string;
    name: string | null;
    phone_number: string;
    visits: number | string;
    cancelled: number | string;
    total_spend: number | string | null;
    first_booking: unknown;
    last_booking: unknown;
    no_shows: number | string;
  }>(
    `SELECT b.booked_by AS user_id, pl.full_name AS name, u.phone_number,
            SUM(b.booking_status <> 'CANCELLED') AS visits,
            SUM(b.booking_status = 'CANCELLED') AS cancelled,
            SUM(CASE WHEN b.booking_status <> 'CANCELLED' THEN b.booking_amount ELSE 0 END) AS total_spend,
            MIN(CASE WHEN b.booking_status <> 'CANCELLED' THEN b.booking_date END) AS first_booking,
            MAX(CASE WHEN b.booking_status <> 'CANCELLED' THEN b.booking_date END) AS last_booking,
            (SELECT COUNT(*) FROM match_players mp
               JOIN matches m ON m.match_id = mp.match_id
               JOIN bookings bb ON bb.booking_id = m.booking_id
               JOIN turfs tt ON tt.turf_id = bb.turf_id
              WHERE mp.player_id = pl.player_id AND mp.attendance_status = 'NO_SHOW'
                AND tt.owner_id = :ownerId) AS no_shows
     FROM bookings b
     JOIN turfs t ON t.turf_id = b.turf_id
     JOIN users u ON u.user_id = b.booked_by
     LEFT JOIN players pl ON pl.user_id = b.booked_by
     WHERE t.owner_id = :ownerId AND t.deleted_at IS NULL${extra}
       AND NOT EXISTS (SELECT 1 FROM matches tmx WHERE tmx.booking_id = b.booking_id AND tmx.tournament_id IS NOT NULL)
     GROUP BY b.booked_by, pl.player_id, pl.full_name, u.phone_number
     ORDER BY total_spend DESC
     LIMIT 1000`,
    { type: QueryTypes.SELECT, replacements },
  );

  const today = new Date();
  const out = rows.map((r) => {
    const visits = Number(r.visits ?? 0);
    const first = dateStr(r.first_booking);
    const last = dateStr(r.last_booking);
    return {
      user_id: r.user_id,
      name: r.name,
      phone_number: r.phone_number,
      visits,
      cancelled: Number(r.cancelled ?? 0),
      no_shows: Number(r.no_shows ?? 0),
      total_spend: Number(r.total_spend ?? 0),
      first_booking: first,
      last_booking: last,
      segment: segmentFor(visits, first, last, today),
    };
  });
  return filters.segment ? out.filter((c) => c.segment === filters.segment) : out;
}

export interface CustomerBooking {
  booking_id: string;
  turf_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_amount: number;
  booking_status: string;
  payment_mode: string;
}

export async function getCustomer(ownerId: string, userId: string) {
  const [summary] = (await listCustomers(ownerId)).filter((c) => c.user_id === userId);
  if (!summary) throw new CustomerError('Customer not found.', 404);

  const bookings = await sequelize.query<CustomerBooking>(
    `SELECT b.booking_id, t.turf_name, b.booking_date, b.start_time, b.end_time,
            b.booking_amount, b.booking_status, b.payment_mode
     FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
     WHERE t.owner_id = :ownerId AND b.booked_by = :userId AND t.deleted_at IS NULL
     ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 50`,
    { type: QueryTypes.SELECT, replacements: { ownerId, userId } },
  );
  return {
    customer: summary,
    bookings: bookings.map((b) => ({
      ...b,
      booking_date: dateStr(b.booking_date) as string,
      booking_amount: Number(b.booking_amount),
    })),
  };
}
