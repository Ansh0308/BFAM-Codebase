import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { TurfNotFoundError } from '../domain/errors';

// Fixed slot grid the whole availability/booking flow is built on. Because
// the DB's no-double-booking guarantee (Phase 1) is a composite unique
// constraint on the exact tuple (turf_id, booking_date, start_time), every
// booking must start on one of these grid-aligned boundaries — that's what
// makes "no two bookings share a start_time" equivalent to "no two bookings
// overlap" for this MVP.
export const SLOT_DURATION_MINUTES = 60;

export interface TurfListFilters {
  city?: string;
  q?: string;
  ball_type?: string;
  min_price?: number;
  max_price?: number;
  lat?: number;
  lng?: number;
  page?: number;
  page_size?: number;
}

function toTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

export function resolveDayType(dateStr: string): 'WEEKDAY' | 'WEEKEND' {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
}

interface TurfRow {
  turf_id: string;
  owner_id: string;
  turf_name: string;
  description: string | null;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  ball_types_supported: string | string[] | null;
  stadium_sound_enabled: boolean;
  turf_status: string;
  average_rating: number | null;
  distance_km?: number;
  cover_image_url?: string | null;
  min_price_per_hour?: number | null;
}

function parseBallTypes(value: TurfRow['ball_types_supported']): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

// Turf Listing: search/filter only (PRD §12.7). Map view is explicitly
// deferred — `lat`/`lng` here only drive a "Near You" distance sort, never
// a map UI.
export async function listTurfs(filters: TurfListFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.page_size ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ["t.turf_status = 'ACTIVE'", 't.deleted_at IS NULL'];
  const replacements: Record<string, unknown> = { limit: pageSize, offset };

  if (filters.city) {
    conditions.push('t.city LIKE :city');
    replacements.city = `%${filters.city}%`;
  }
  if (filters.q) {
    conditions.push('(t.turf_name LIKE :q OR t.address_line LIKE :q)');
    replacements.q = `%${filters.q}%`;
  }
  if (filters.ball_type) {
    conditions.push('JSON_CONTAINS(t.ball_types_supported, :ballType)');
    replacements.ballType = JSON.stringify(filters.ball_type);
  }

  const hasCoords = filters.lat !== undefined && filters.lng !== undefined;
  const distanceExpr = hasCoords
    ? `(6371 * ACOS(COS(RADIANS(:lat)) * COS(RADIANS(t.latitude)) * COS(RADIANS(t.longitude) - RADIANS(:lng)) + SIN(RADIANS(:lat)) * SIN(RADIANS(t.latitude))))`
    : 'NULL';
  if (hasCoords) {
    replacements.lat = filters.lat;
    replacements.lng = filters.lng;
  }

  const priceHaving: string[] = [];
  if (filters.min_price !== undefined) {
    priceHaving.push('min_price_per_hour >= :minPrice');
    replacements.minPrice = filters.min_price;
  }
  if (filters.max_price !== undefined) {
    priceHaving.push('min_price_per_hour <= :maxPrice');
    replacements.maxPrice = filters.max_price;
  }

  const orderBy = hasCoords ? 'distance_km ASC' : 't.turf_name ASC';

  const sql = `
    SELECT
      t.turf_id, t.owner_id, t.turf_name, t.description, t.address_line, t.city,
      t.latitude, t.longitude, t.ball_types_supported, t.stadium_sound_enabled,
      t.turf_status, t.average_rating,
      ${distanceExpr} AS distance_km,
      (SELECT image_url FROM turf_images ti WHERE ti.turf_id = t.turf_id ORDER BY ti.display_order ASC LIMIT 1) AS cover_image_url,
      (SELECT MIN(price_per_hour) FROM turf_pricing tp WHERE tp.turf_id = t.turf_id
        AND (tp.effective_to IS NULL OR tp.effective_to >= CURDATE())) AS min_price_per_hour
    FROM turfs t
    WHERE ${conditions.join(' AND ')}
    ${priceHaving.length ? `HAVING ${priceHaving.join(' AND ')}` : ''}
    ORDER BY ${orderBy}
    LIMIT :limit OFFSET :offset
  `;

  const rows = await sequelize.query<TurfRow>(sql, { type: QueryTypes.SELECT, replacements });

  return {
    page,
    page_size: pageSize,
    results: rows.map((row) => ({
      turf_id: row.turf_id,
      turf_name: row.turf_name,
      city: row.city,
      address_line: row.address_line,
      ball_types_supported: parseBallTypes(row.ball_types_supported),
      average_rating: row.average_rating,
      cover_image_url: row.cover_image_url ?? null,
      min_price_per_hour: row.min_price_per_hour ?? null,
      distance_km: row.distance_km === null ? null : Number(row.distance_km),
    })),
  };
}

export async function getTurfDetails(turfId: string) {
  const [turf] = await sequelize.query<TurfRow>(
    `SELECT turf_id, owner_id, turf_name, description, address_line, city, latitude, longitude,
            ball_types_supported, stadium_sound_enabled, turf_status, average_rating
     FROM turfs WHERE turf_id = :turfId AND turf_status = 'ACTIVE' AND deleted_at IS NULL`,
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );

  if (!turf) return null;

  const [images, facilities, operatingHours, pricing] = await Promise.all([
    sequelize.query(
      'SELECT image_id, image_url, display_order FROM turf_images WHERE turf_id = :turfId ORDER BY display_order ASC',
      { type: QueryTypes.SELECT, replacements: { turfId } },
    ),
    sequelize.query(
      'SELECT facility_id, facility_name FROM turf_facilities WHERE turf_id = :turfId',
      {
        type: QueryTypes.SELECT,
        replacements: { turfId },
      },
    ),
    sequelize.query(
      'SELECT hours_id, day_of_week, open_time, close_time FROM turf_operating_hours WHERE turf_id = :turfId ORDER BY day_of_week ASC',
      { type: QueryTypes.SELECT, replacements: { turfId } },
    ),
    sequelize.query(
      `SELECT pricing_id, day_type, start_time, end_time, price_per_hour, currency
       FROM turf_pricing WHERE turf_id = :turfId AND (effective_to IS NULL OR effective_to >= CURDATE())
       ORDER BY day_type ASC, start_time ASC`,
      { type: QueryTypes.SELECT, replacements: { turfId } },
    ),
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const availabilityPreview = await getTurfAvailability(turfId, todayStr);

  return {
    ...turf,
    ball_types_supported: parseBallTypes(turf.ball_types_supported),
    images,
    facilities,
    operating_hours: operatingHours,
    pricing,
    // Short preview slice for the Turf Details screen's slot-grid pattern
    // (Design §3.3); the full grid lives on the dedicated Availability screen.
    availability_preview: availabilityPreview
      ? { date: availabilityPreview.date, slots: availabilityPreview.slots.slice(0, 8) }
      : null,
  };
}

interface OperatingHoursRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
}

interface BookingRow {
  start_time: string;
  duration_minutes: number;
}

interface BlockRow {
  start_datetime: string;
  end_datetime: string;
}

interface PricingRow {
  day_type: string;
  start_time: string;
  end_time: string;
  price_per_hour: string;
  effective_from: string;
  effective_to: string | null;
}

export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

export interface Slot {
  start_time: string;
  end_time: string;
  status: SlotStatus;
  price_per_hour: number | null;
}

async function findPricingForSlot(
  turfId: string,
  dateStr: string,
  startTime: string,
): Promise<PricingRow | null> {
  const dayType = resolveDayType(dateStr);
  const rows = await sequelize.query<PricingRow>(
    `SELECT day_type, start_time, end_time, price_per_hour, effective_from, effective_to
     FROM turf_pricing
     WHERE turf_id = :turfId AND day_type = :dayType
       AND start_time <= :startTime AND end_time > :startTime
       AND effective_from <= :date AND (effective_to IS NULL OR effective_to >= :date)
     LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { turfId, dayType, startTime, date: dateStr } },
  );
  return rows[0] ?? null;
}

// Turf Availability: calendar/slot grid for a single date (Design §1.2/§1.3 —
// booked slots render as a disabled gray surface, available slots as
// brand-red text/dot; this service only returns status, styling is a mobile
// concern).
export async function getTurfAvailability(turfId: string, dateStr: string) {
  const [turf] = await sequelize.query<{ turf_id: string }>(
    "SELECT turf_id FROM turfs WHERE turf_id = :turfId AND turf_status = 'ACTIVE' AND deleted_at IS NULL",
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (!turf) throw new TurfNotFoundError(turfId);

  const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

  const [hours] = await sequelize.query<OperatingHoursRow>(
    'SELECT day_of_week, open_time, close_time FROM turf_operating_hours WHERE turf_id = :turfId AND day_of_week = :dayOfWeek',
    { type: QueryTypes.SELECT, replacements: { turfId, dayOfWeek } },
  );

  if (!hours) {
    return {
      turf_id: turfId,
      date: dateStr,
      day_type: resolveDayType(dateStr),
      slots: [] as Slot[],
    };
  }

  const [bookings, blocks] = await Promise.all([
    sequelize.query<BookingRow>(
      `SELECT start_time, duration_minutes FROM bookings
       WHERE turf_id = :turfId AND booking_date = :date AND booking_status IN ('PENDING','CONFIRMED')`,
      { type: QueryTypes.SELECT, replacements: { turfId, date: dateStr } },
    ),
    sequelize.query<BlockRow>(
      `SELECT start_datetime, end_datetime FROM turf_availability_blocks
       WHERE turf_id = :turfId AND start_datetime < :dayEnd AND end_datetime > :dayStart`,
      {
        type: QueryTypes.SELECT,
        replacements: { turfId, dayStart: `${dateStr} 00:00:00`, dayEnd: `${dateStr} 23:59:59` },
      },
    ),
  ]);

  const bookedRanges = bookings.map((b) => {
    const start = toTimeMinutes(b.start_time);
    return { start, end: start + b.duration_minutes };
  });
  const blockedRanges = blocks.map((b) => ({
    start: new Date(b.start_datetime).getTime(),
    end: new Date(b.end_datetime).getTime(),
  }));

  const openMinutes = toTimeMinutes(hours.open_time);
  const closeMinutes = toTimeMinutes(hours.close_time);

  const slots: Slot[] = [];
  for (
    let start = openMinutes;
    start + SLOT_DURATION_MINUTES <= closeMinutes;
    start += SLOT_DURATION_MINUTES
  ) {
    const end = start + SLOT_DURATION_MINUTES;
    const startTimeStr = toTimeString(start);
    const endTimeStr = toTimeString(end);

    const isBooked = bookedRanges.some((r) => start < r.end && end > r.start);
    const slotStartMs = new Date(`${dateStr}T${startTimeStr}Z`).getTime();
    const slotEndMs = new Date(`${dateStr}T${endTimeStr}Z`).getTime();
    const isBlocked = blockedRanges.some((r) => slotStartMs < r.end && slotEndMs > r.start);

    const pricing = await findPricingForSlot(turfId, dateStr, startTimeStr);

    slots.push({
      start_time: startTimeStr,
      end_time: endTimeStr,
      status: isBooked ? 'BOOKED' : isBlocked ? 'BLOCKED' : 'AVAILABLE',
      price_per_hour: pricing ? Number(pricing.price_per_hour) : null,
    });
  }

  return { turf_id: turfId, date: dateStr, day_type: resolveDayType(dateStr), slots };
}
