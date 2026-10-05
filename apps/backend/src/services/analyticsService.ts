import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Web analytics (PRD §9.1 / §9.2 / §23.1): one aggregation service behind both
// the Owner dashboard (scoped to the owner's own turfs) and the Admin
// dashboard (the whole platform). Every figure is a plain aggregate over
// `bookings`, `payment_obligations`, `turf_operating_hours` and
// `match_players`, for a date range plus the equal-length range before it so
// the UI can show "vs previous period".
//
// Definitions (kept deliberately simple and stated in the UI):
//  - Revenue    = booking_amount of bookings that were not cancelled.
//  - Collected  = payment obligations of those bookings that are PAID.
//  - Occupancy  = booked minutes / opening minutes (operating hours) in range.
//  - Peak hours = bookings by the hour they start.

export class AnalyticsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export interface AnalyticsScope {
  /** Restrict to one owner's turfs. Omit for the whole platform (admin). */
  ownerId?: string;
  /** Restrict to a single turf (must belong to ownerId when both are set). */
  turfId?: string;
}

export interface AnalyticsSummary {
  bookings: number;
  cancelled: number;
  cancellation_rate: number;
  revenue: number;
  collected: number;
  outstanding: number;
  avg_booking_value: number;
  unique_customers: number;
  new_customers: number;
  occupancy_pct: number;
  no_shows: number;
}

export interface AnalyticsResult {
  range: { from: string; to: string; days: number };
  previous_range: { from: string; to: string };
  summary: AnalyticsSummary;
  previous: AnalyticsSummary;
  daily: { date: string; bookings: number; revenue: number }[];
  peak_hours: { hour: number; bookings: number }[];
  by_weekday: { dow: number; bookings: number; revenue: number }[];
  by_turf: {
    turf_id: string;
    turf_name: string;
    bookings: number;
    revenue: number;
    occupancy_pct: number;
  }[];
  /** Platform-wide only. */
  growth?: { date: string; new_players: number }[];
  payment_modes: { mode: string; bookings: number }[];
}

const MAX_DAYS = 366;
const DAY_MS = 86_400_000;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, n: number) =>
  iso(new Date(toDate(isoDate).getTime() + n * DAY_MS));
const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

function whereFor(scope: AnalyticsScope, alias = 't') {
  const clauses: string[] = [];
  const replacements: Record<string, unknown> = {};
  if (scope.ownerId) {
    clauses.push(`${alias}.owner_id = :ownerId`);
    replacements.ownerId = scope.ownerId;
  }
  if (scope.turfId) {
    clauses.push(`${alias}.turf_id = :turfId`);
    replacements.turfId = scope.turfId;
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', replacements };
}

function timeToMinutes(t: string): number {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Opening minutes per turf across the range, from the weekly operating hours.
async function openingMinutes(
  scope: AnalyticsScope,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const w = whereFor(scope);
  const hours = await sequelize.query<{
    turf_id: string;
    day_of_week: number;
    open_time: string;
    close_time: string;
  }>(
    `SELECT h.turf_id, h.day_of_week, h.open_time, h.close_time
     FROM turf_operating_hours h JOIN turfs t ON t.turf_id = h.turf_id
     WHERE t.deleted_at IS NULL${w.sql}`,
    { type: QueryTypes.SELECT, replacements: w.replacements },
  );
  // How many of each weekday fall in the range.
  const dowCount = [0, 0, 0, 0, 0, 0, 0];
  for (let d = toDate(from); d <= toDate(to); d = new Date(d.getTime() + DAY_MS)) {
    dowCount[d.getUTCDay()] += 1;
  }
  const out = new Map<string, number>();
  for (const h of hours) {
    let mins = timeToMinutes(h.close_time) - timeToMinutes(h.open_time);
    if (mins <= 0) mins += 24 * 60; // closes after midnight
    out.set(h.turf_id, (out.get(h.turf_id) ?? 0) + mins * dowCount[Number(h.day_of_week) % 7]);
  }
  return out;
}

async function summarize(
  scope: AnalyticsScope,
  from: string,
  to: string,
): Promise<AnalyticsSummary> {
  const w = whereFor(scope);
  const base = { ...w.replacements, from, to };

  const [totals] = await sequelize.query<{
    bookings: number | string;
    cancelled: number | string;
    revenue: number | string | null;
    minutes: number | string | null;
    customers: number | string;
  }>(
    `SELECT COUNT(*) AS bookings,
            SUM(b.booking_status = 'CANCELLED') AS cancelled,
            SUM(CASE WHEN b.booking_status <> 'CANCELLED' THEN b.booking_amount ELSE 0 END) AS revenue,
            SUM(CASE WHEN b.booking_status <> 'CANCELLED' THEN b.duration_minutes ELSE 0 END) AS minutes,
            COUNT(DISTINCT b.booked_by) AS customers
     FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
     WHERE b.booking_date BETWEEN :from AND :to${w.sql}`,
    { type: QueryTypes.SELECT, replacements: base },
  );

  const [collected] = await sequelize.query<{ total: number | string | null }>(
    `SELECT SUM(o.amount_due) AS total
     FROM payment_obligations o
     JOIN bookings b ON b.booking_id = o.booking_id
     JOIN turfs t ON t.turf_id = b.turf_id
     WHERE o.due_status = 'PAID' AND b.booking_status <> 'CANCELLED'
       AND b.booking_date BETWEEN :from AND :to${w.sql}`,
    { type: QueryTypes.SELECT, replacements: base },
  );

  // Customers whose first-ever booking (at these turfs) falls inside the range.
  const [fresh] = await sequelize.query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT b.booked_by, MIN(b.booking_date) AS first_date
       FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
       WHERE b.booking_status <> 'CANCELLED'${w.sql}
       GROUP BY b.booked_by
     ) f WHERE f.first_date BETWEEN :from AND :to`,
    { type: QueryTypes.SELECT, replacements: base },
  );

  const [noShow] = await sequelize.query<{ n: number | string }>(
    `SELECT COUNT(*) AS n
     FROM match_players mp
     JOIN matches m ON m.match_id = mp.match_id
     JOIN bookings b ON b.booking_id = m.booking_id
     JOIN turfs t ON t.turf_id = b.turf_id
     WHERE mp.attendance_status = 'NO_SHOW'
       AND b.booking_date BETWEEN :from AND :to${w.sql}`,
    { type: QueryTypes.SELECT, replacements: base },
  );

  const open = await openingMinutes(scope, from, to);
  const openTotal = [...open.values()].reduce((a, b) => a + b, 0);

  const bookings = num(totals?.bookings);
  const cancelled = num(totals?.cancelled);
  const revenue = num(totals?.revenue);
  const live = bookings - cancelled;
  const collectedTotal = num(collected?.total);

  return {
    bookings,
    cancelled,
    cancellation_rate: bookings > 0 ? round2((cancelled / bookings) * 100) : 0,
    revenue,
    collected: collectedTotal,
    outstanding: Math.max(revenue - collectedTotal, 0),
    avg_booking_value: live > 0 ? round2(revenue / live) : 0,
    unique_customers: num(totals?.customers),
    new_customers: num(fresh?.n),
    occupancy_pct:
      openTotal > 0 ? Math.min(100, round2((num(totals?.minutes) / openTotal) * 100)) : 0,
    no_shows: num(noShow?.n),
  };
}

export async function getAnalytics(
  scope: AnalyticsScope,
  from: string,
  to: string,
): Promise<AnalyticsResult> {
  const days = Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1;
  if (Number.isNaN(days) || days < 1) {
    throw new AnalyticsError('The end date must be on or after the start date.', 400);
  }
  if (days > MAX_DAYS) {
    throw new AnalyticsError(`Choose a range of at most ${MAX_DAYS} days.`, 400);
  }
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -days);

  const w = whereFor(scope);
  const base = { ...w.replacements, from, to };

  const [summary, previous, dailyRows, hourRows, dowRows, turfRows, modeRows] = await Promise.all([
    summarize(scope, from, to),
    summarize(scope, prevFrom, prevTo),
    sequelize.query<{
      d: string | Date;
      bookings: number | string;
      revenue: number | string | null;
    }>(
      `SELECT b.booking_date AS d, COUNT(*) AS bookings,
              SUM(CASE WHEN b.booking_status <> 'CANCELLED' THEN b.booking_amount ELSE 0 END) AS revenue
       FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
       WHERE b.booking_status <> 'CANCELLED' AND b.booking_date BETWEEN :from AND :to${w.sql}
       GROUP BY b.booking_date`,
      { type: QueryTypes.SELECT, replacements: base },
    ),
    sequelize.query<{ h: number | string; bookings: number | string }>(
      `SELECT HOUR(b.start_time) AS h, COUNT(*) AS bookings
       FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
       WHERE b.booking_status <> 'CANCELLED' AND b.booking_date BETWEEN :from AND :to${w.sql}
       GROUP BY HOUR(b.start_time)`,
      { type: QueryTypes.SELECT, replacements: base },
    ),
    sequelize.query<{
      dow: number | string;
      bookings: number | string;
      revenue: number | string | null;
    }>(
      `SELECT DAYOFWEEK(b.booking_date) - 1 AS dow, COUNT(*) AS bookings,
              SUM(b.booking_amount) AS revenue
       FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
       WHERE b.booking_status <> 'CANCELLED' AND b.booking_date BETWEEN :from AND :to${w.sql}
       GROUP BY dow`,
      { type: QueryTypes.SELECT, replacements: base },
    ),
    sequelize.query<{
      turf_id: string;
      turf_name: string;
      bookings: number | string;
      revenue: number | string | null;
      minutes: number | string | null;
    }>(
      `SELECT t.turf_id, t.turf_name, COUNT(b.booking_id) AS bookings,
              SUM(b.booking_amount) AS revenue, SUM(b.duration_minutes) AS minutes
       FROM turfs t
       LEFT JOIN bookings b ON b.turf_id = t.turf_id AND b.booking_status <> 'CANCELLED'
            AND b.booking_date BETWEEN :from AND :to
       WHERE t.deleted_at IS NULL${w.sql}
       GROUP BY t.turf_id, t.turf_name
       ORDER BY revenue DESC, bookings DESC
       LIMIT 50`,
      { type: QueryTypes.SELECT, replacements: base },
    ),
    sequelize.query<{ mode: string; bookings: number | string }>(
      `SELECT b.payment_mode AS mode, COUNT(*) AS bookings
       FROM bookings b JOIN turfs t ON t.turf_id = b.turf_id
       WHERE b.booking_status <> 'CANCELLED' AND b.booking_date BETWEEN :from AND :to${w.sql}
       GROUP BY b.payment_mode ORDER BY bookings DESC`,
      { type: QueryTypes.SELECT, replacements: base },
    ),
  ]);

  // Fill every day / hour / weekday so charts have no gaps.
  const byDate = new Map(
    dailyRows.map((r) => [
      typeof r.d === 'string' ? r.d.slice(0, 10) : iso(r.d),
      { bookings: num(r.bookings), revenue: num(r.revenue) },
    ]),
  );
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return {
      date,
      bookings: byDate.get(date)?.bookings ?? 0,
      revenue: byDate.get(date)?.revenue ?? 0,
    };
  });

  const hourMap = new Map(hourRows.map((r) => [num(r.h), num(r.bookings)]));
  const peak_hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    bookings: hourMap.get(hour) ?? 0,
  }));

  const dowMap = new Map(dowRows.map((r) => [num(r.dow), r]));
  const by_weekday = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    bookings: num(dowMap.get(dow)?.bookings),
    revenue: num(dowMap.get(dow)?.revenue),
  }));

  const open = await openingMinutes(scope, from, to);
  const by_turf = turfRows.map((r) => {
    const openMins = open.get(r.turf_id) ?? 0;
    return {
      turf_id: r.turf_id,
      turf_name: r.turf_name,
      bookings: num(r.bookings),
      revenue: num(r.revenue),
      occupancy_pct: openMins > 0 ? Math.min(100, round2((num(r.minutes) / openMins) * 100)) : 0,
    };
  });

  let growth: AnalyticsResult['growth'];
  if (!scope.ownerId && !scope.turfId) {
    const rows = await sequelize.query<{ d: string | Date; n: number | string }>(
      `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM users
       WHERE role = 'PLAYER' AND deleted_at IS NULL AND DATE(created_at) BETWEEN :from AND :to
       GROUP BY DATE(created_at)`,
      { type: QueryTypes.SELECT, replacements: { from, to } },
    );
    const m = new Map(
      rows.map((r) => [typeof r.d === 'string' ? r.d.slice(0, 10) : iso(r.d), num(r.n)]),
    );
    growth = Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, new_players: m.get(date) ?? 0 };
    });
  }

  return {
    range: { from, to, days },
    previous_range: { from: prevFrom, to: prevTo },
    summary,
    previous,
    daily,
    peak_hours,
    by_weekday,
    by_turf,
    ...(growth ? { growth } : {}),
    payment_modes: modeRows.map((r) => ({ mode: r.mode, bookings: num(r.bookings) })),
  };
}

// An owner may only look at their own turfs.
export async function assertOwnsTurf(ownerId: string, turfId: string): Promise<void> {
  const rows = await sequelize.query<{ turf_id: string }>(
    'SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :ownerId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId, ownerId } },
  );
  if (rows.length === 0) throw new AnalyticsError('Turf not found.', 404);
}
