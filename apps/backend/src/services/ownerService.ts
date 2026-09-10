import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { ForbiddenActionError, TurfNotFoundError, VenueNotFoundError } from '../domain/errors';

interface TurfRow {
  turf_id: string;
  owner_id: string;
  venue_id: string | null;
}

async function fetchTurfOrThrow(turfId: string): Promise<TurfRow> {
  const [turf] = await sequelize.query<TurfRow>(
    'SELECT turf_id, owner_id, venue_id FROM turfs WHERE turf_id = :turfId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (!turf) throw new TurfNotFoundError(turfId);
  return turf;
}

async function assertIsOwner(turf: TurfRow, actorUserId: string) {
  if (turf.owner_id !== actorUserId) {
    throw new ForbiddenActionError('Only this turf’s owner can do that.');
  }
}

interface VenueRow {
  venue_id: string;
  owner_id: string;
  venue_name: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
}

async function fetchVenueOrThrow(venueId: string): Promise<VenueRow> {
  const [venue] = await sequelize.query<VenueRow>(
    'SELECT * FROM venues WHERE venue_id = :venueId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { venueId } },
  );
  if (!venue) throw new VenueNotFoundError(venueId);
  return venue;
}

async function assertOwnsVenue(venue: VenueRow, actorUserId: string) {
  if (venue.owner_id !== actorUserId) {
    throw new ForbiddenActionError('Only this venue’s owner can do that.');
  }
}

// Owner Dashboard (module 2.12, PRD §8.3) — every turf this owner runs.
export async function listMyTurfs(ownerUserId: string) {
  return sequelize.query(
    `SELECT t.*, v.venue_name FROM turfs t
     LEFT JOIN venues v ON v.venue_id = t.venue_id
     WHERE t.owner_id = :ownerUserId AND t.deleted_at IS NULL
     ORDER BY t.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { ownerUserId } },
  );
}

// Builds an insertable `turfs` row with sensible defaults, shared by
// createTurf and createVenue's "create N pitches at once" path so the two
// stay in sync.
function buildTurfRow(params: {
  ownerUserId: string;
  venueId: string | null;
  turfName: string;
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
  now: Date;
}) {
  return {
    turf_id: randomUUID(),
    owner_id: params.ownerUserId,
    venue_id: params.venueId,
    turf_name: params.turfName,
    description: null,
    address_line: params.addressLine,
    city: params.city,
    latitude: params.latitude,
    longitude: params.longitude,
    ball_types_supported: JSON.stringify([]),
    stadium_sound_enabled: true,
    turf_status: 'ACTIVE',
    average_rating: null,
    created_at: params.now,
    updated_at: params.now,
    deleted_at: null,
  };
}

// Venues (feedback backlog A-2) — a display/grouping layer over one or more
// `turfs` rows at the same physical location (e.g. "Redline Sports Complex"
// grouping Pitch 1/Pitch 2). Each turf under a venue is still its own
// independently bookable listing; nothing about booking changes.
export interface CreateVenueInput {
  venue_name: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  // How many pitches to create alongside the venue, auto-named "Pitch 1",
  // "Pitch 2", etc. (feedback: creating a venue and then each of its
  // pitches separately was too many clicks). Omitted/undefined creates a
  // bare venue with no pitches yet.
  pitch_count?: number;
}

export async function createVenue(ownerUserId: string, input: CreateVenueInput) {
  const venueId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('venues', [
    {
      venue_id: venueId,
      owner_id: ownerUserId,
      venue_name: input.venue_name,
      address_line: input.address_line,
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ]);

  if (input.pitch_count) {
    const pitchRows = Array.from({ length: input.pitch_count }, (_, i) =>
      buildTurfRow({
        ownerUserId,
        venueId,
        turfName: `Pitch ${i + 1}`,
        addressLine: input.address_line,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
        now,
      }),
    );
    await sequelize.getQueryInterface().bulkInsert('turfs', pitchRows);
  }

  return getVenueForOwner(venueId, ownerUserId);
}

export async function listMyVenues(ownerUserId: string) {
  return sequelize.query(
    `SELECT v.*,
       (SELECT COUNT(*) FROM turfs t WHERE t.venue_id = v.venue_id AND t.deleted_at IS NULL) AS pitch_count
     FROM venues v
     WHERE v.owner_id = :ownerUserId AND v.deleted_at IS NULL
     ORDER BY v.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { ownerUserId } },
  );
}

export async function getVenueForOwner(venueId: string, ownerUserId: string) {
  const venue = await fetchVenueOrThrow(venueId);
  await assertOwnsVenue(venue, ownerUserId);
  const turfs = await sequelize.query(
    'SELECT * FROM turfs WHERE venue_id = :venueId AND deleted_at IS NULL ORDER BY created_at ASC',
    { type: QueryTypes.SELECT, replacements: { venueId } },
  );
  return { ...venue, turfs };
}

export type UpdateVenueInput = Partial<CreateVenueInput>;

// Editing a venue's address cascades to every pitch under it — confirmed
// with the founder that a venue's pitches share one real-world address
// rather than independently-editable ones (see the migration's comment).
// turf_name/description/ball_types_supported etc. are untouched — only the
// address-shaped columns a venue actually owns.
export async function updateVenue(venueId: string, ownerUserId: string, input: UpdateVenueInput) {
  const venue = await fetchVenueOrThrow(venueId);
  await assertOwnsVenue(venue, ownerUserId);

  const now = new Date();
  const nextVenue = { ...venue, ...input };
  await sequelize.getQueryInterface().bulkUpdate(
    'venues',
    {
      venue_name: nextVenue.venue_name,
      address_line: nextVenue.address_line,
      city: nextVenue.city,
      latitude: nextVenue.latitude,
      longitude: nextVenue.longitude,
      updated_at: now,
    },
    { venue_id: venueId },
  );

  const addressChanged =
    input.address_line !== undefined ||
    input.city !== undefined ||
    input.latitude !== undefined ||
    input.longitude !== undefined;
  if (addressChanged) {
    await sequelize.getQueryInterface().bulkUpdate(
      'turfs',
      {
        address_line: nextVenue.address_line,
        city: nextVenue.city,
        latitude: nextVenue.latitude,
        longitude: nextVenue.longitude,
        updated_at: now,
      },
      { venue_id: venueId },
    );
  }

  return getVenueForOwner(venueId, ownerUserId);
}

// Retroactively groups an already-existing standalone turf into a venue —
// locks its address to the venue's, same as a pitch created under the
// venue from the start.
export async function assignTurfToVenue(turfId: string, ownerUserId: string, venueId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);
  const venue = await fetchVenueOrThrow(venueId);
  await assertOwnsVenue(venue, ownerUserId);

  await sequelize.getQueryInterface().bulkUpdate(
    'turfs',
    {
      venue_id: venueId,
      address_line: venue.address_line,
      city: venue.city,
      latitude: venue.latitude,
      longitude: venue.longitude,
      updated_at: new Date(),
    },
    { turf_id: turfId },
  );

  return getTurfForOwner(turfId, ownerUserId);
}

export interface CreateTurfInput {
  turf_name: string;
  description?: string | null;
  // Required unless venue_id is given — a pitch created under a venue
  // inherits (and stays locked to) that venue's address (backlog A-2).
  address_line?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  ball_types_supported?: string[];
  venue_id?: string | null;
}

// Turf Management (module 2.12, PRD §8.3/§9.2) — the module 2.3 turfService
// only ever read turfs (discovery); this is the first owner-authoring path.
export async function createTurf(ownerUserId: string, input: CreateTurfInput) {
  let addressLine = input.address_line;
  let city = input.city;
  let latitude = input.latitude;
  let longitude = input.longitude;

  if (input.venue_id) {
    const venue = await fetchVenueOrThrow(input.venue_id);
    await assertOwnsVenue(venue, ownerUserId);
    addressLine = venue.address_line;
    city = venue.city;
    latitude = venue.latitude;
    longitude = venue.longitude;
  }

  // Guaranteed non-null by createTurfSchema's superRefine (address fields
  // required unless venue_id is set) — the venue branch above fills them
  // from the venue either way, so this can't actually happen; it's here so
  // TypeScript knows the values are defined below, not a real runtime path.
  if (
    addressLine === undefined ||
    city === undefined ||
    latitude === undefined ||
    longitude === undefined
  ) {
    throw new Error('Address, city, latitude, and longitude are required.');
  }

  const turfId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('turfs', [
    {
      turf_id: turfId,
      owner_id: ownerUserId,
      venue_id: input.venue_id ?? null,
      turf_name: input.turf_name,
      description: input.description ?? null,
      address_line: addressLine,
      city: city,
      latitude: latitude,
      longitude: longitude,
      ball_types_supported: JSON.stringify(input.ball_types_supported ?? []),
      stadium_sound_enabled: true,
      turf_status: 'ACTIVE',
      average_rating: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ]);
  return getTurfForOwner(turfId, ownerUserId);
}

export async function getTurfForOwner(turfId: string, ownerUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);
  const [row] = await sequelize.query(
    `SELECT t.*, v.venue_name FROM turfs t
     LEFT JOIN venues v ON v.venue_id = t.venue_id
     WHERE t.turf_id = :turfId`,
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  return row;
}

export interface UpdateTurfInput {
  turf_name?: string;
  description?: string | null;
  address_line?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  ball_types_supported?: string[];
}

export async function updateTurf(turfId: string, ownerUserId: string, updates: UpdateTurfInput) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  // A pitch linked to a venue has its address auto-filled and locked to
  // that venue (backlog A-2) — edit the venue's address instead, which
  // cascades to every pitch under it.
  const editingAddress =
    updates.address_line !== undefined ||
    updates.city !== undefined ||
    updates.latitude !== undefined ||
    updates.longitude !== undefined;
  if (turf.venue_id && editingAddress) {
    throw new ForbiddenActionError(
      'This pitch’s address is managed by its venue. Edit the venue instead.',
    );
  }

  const values: Record<string, unknown> = { updated_at: new Date() };
  if (updates.turf_name !== undefined) values.turf_name = updates.turf_name;
  if (updates.description !== undefined) values.description = updates.description;
  if (updates.address_line !== undefined) values.address_line = updates.address_line;
  if (updates.city !== undefined) values.city = updates.city;
  if (updates.latitude !== undefined) values.latitude = updates.latitude;
  if (updates.longitude !== undefined) values.longitude = updates.longitude;
  if (updates.ball_types_supported !== undefined) {
    values.ball_types_supported = JSON.stringify(updates.ball_types_supported);
  }

  await sequelize.getQueryInterface().bulkUpdate('turfs', values, { turf_id: turfId });
  return getTurfForOwner(turfId, ownerUserId);
}

// Sound Settings (module 2.12, PRD §8.3/§9.2) — enables/disables the
// stadium audio system (module 2.7's Countdown Intro reads this same
// column via matchIntroService.getStadiumSoundEnabled).
export async function setStadiumSoundEnabled(
  turfId: string,
  ownerUserId: string,
  enabled: boolean,
) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turfs',
      { stadium_sound_enabled: enabled, updated_at: new Date() },
      { turf_id: turfId },
    );
  return { turf_id: turfId, stadium_sound_enabled: enabled };
}

export async function listPricing(turfId: string, ownerUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);
  return sequelize.query('SELECT * FROM turf_pricing WHERE turf_id = :turfId', {
    type: QueryTypes.SELECT,
    replacements: { turfId },
  });
}

export interface PricingRow {
  day_type: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  start_time: string;
  end_time: string;
  price_per_hour: number;
}

// Pricing (module 2.12, PRD §8.3/§9.2) — replaces the turf's full pricing
// table each time, same "delete + reinsert" idempotent pattern as module
// 2.10's stat materialization, rather than trying to diff individual rows.
export async function setPricing(turfId: string, ownerUserId: string, rows: PricingRow[]) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkDelete('turf_pricing', { turf_id: turfId }, { transaction });
    if (rows.length > 0) {
      // effective_from has no DB default (NOT NULL) and the owner portal's
      // pricing form doesn't collect it — a new/replaced rate is effective
      // immediately, so default it to today rather than rejecting the row.
      const today = new Date().toISOString().slice(0, 10);
      await sequelize.getQueryInterface().bulkInsert(
        'turf_pricing',
        rows.map((r) => ({
          pricing_id: randomUUID(),
          turf_id: turfId,
          day_type: r.day_type,
          start_time: r.start_time,
          end_time: r.end_time,
          price_per_hour: r.price_per_hour,
          currency: 'INR',
          effective_from: today,
        })),
        { transaction },
      );
    }
  });

  return sequelize.query('SELECT * FROM turf_pricing WHERE turf_id = :turfId', {
    type: QueryTypes.SELECT,
    replacements: { turfId },
  });
}

export async function listOperatingHours(turfId: string, ownerUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);
  return sequelize.query(
    'SELECT * FROM turf_operating_hours WHERE turf_id = :turfId ORDER BY day_of_week ASC',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
}

export interface OperatingHoursRow {
  day_of_week: number; // 0 (Sunday) - 6 (Saturday), matches JS Date#getUTCDay()
  open_time: string;
  close_time: string;
}

// Operating Hours — a real gap found during a live Phase 2 walkthrough:
// bookingService.createBooking has always required a turf_operating_hours
// row for the requested day (no row = OutsideOperatingHoursError, PRD §15),
// but until now nothing in the app (owner mobile, owner web, or any API
// route) could ever create one — only the demo/phase1 seed scripts wrote
// to this table. Every turf an owner created through the real Turf
// Management flow was permanently unbookable. Same delete+reinsert
// idempotent pattern as setPricing above.
export async function setOperatingHours(
  turfId: string,
  ownerUserId: string,
  rows: OperatingHoursRow[],
) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkDelete('turf_operating_hours', { turf_id: turfId }, { transaction });
    if (rows.length > 0) {
      await sequelize.getQueryInterface().bulkInsert(
        'turf_operating_hours',
        rows.map((r) => ({
          hours_id: randomUUID(),
          turf_id: turfId,
          day_of_week: r.day_of_week,
          open_time: r.open_time,
          close_time: r.close_time,
        })),
        { transaction },
      );
    }
  });

  return sequelize.query(
    'SELECT * FROM turf_operating_hours WHERE turf_id = :turfId ORDER BY day_of_week ASC',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
}

// Availability Management (module 2.12, PRD §8.3/§9.2) — owner-side view
// over module 2.3's turf_availability_blocks (previously write-only from
// the schema's perspective; nothing before this module ever created one).
export async function listAvailabilityBlocks(turfId: string, ownerUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);
  return sequelize.query(
    'SELECT * FROM turf_availability_blocks WHERE turf_id = :turfId ORDER BY start_datetime ASC',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
}

export interface CreateAvailabilityBlockInput {
  start_datetime: string;
  end_datetime: string;
  reason: 'MAINTENANCE' | 'HOLIDAY' | 'OWNER_BLOCK' | 'SYSTEM_BLOCK';
}

export async function createAvailabilityBlock(
  turfId: string,
  ownerUserId: string,
  input: CreateAvailabilityBlockInput,
) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  const blockId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('turf_availability_blocks', [
    {
      block_id: blockId,
      turf_id: turfId,
      start_datetime: input.start_datetime,
      end_datetime: input.end_datetime,
      reason: input.reason,
      created_by: ownerUserId,
      created_at: new Date(),
    },
  ]);
  return { block_id: blockId };
}

export async function removeAvailabilityBlock(blockId: string, ownerUserId: string) {
  const [block] = await sequelize.query<{ turf_id: string }>(
    'SELECT turf_id FROM turf_availability_blocks WHERE block_id = :blockId',
    { type: QueryTypes.SELECT, replacements: { blockId } },
  );
  if (!block) return;
  const turf = await fetchTurfOrThrow(block.turf_id);
  await assertIsOwner(turf, ownerUserId);
  await sequelize.getQueryInterface().bulkDelete('turf_availability_blocks', { block_id: blockId });
}

// Today's Bookings (module 2.12, PRD §8.3/§9.2) — every booking, across
// every turf this owner runs, for today.
export async function getTodaysBookings(ownerUserId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return sequelize.query(
    `SELECT b.*, t.turf_name FROM bookings b
     JOIN turfs t ON t.turf_id = b.turf_id
     WHERE t.owner_id = :ownerUserId AND b.booking_date = :today
     ORDER BY b.start_time ASC`,
    { type: QueryTypes.SELECT, replacements: { ownerUserId, today } },
  );
}

// Match Management (module 2.12, PRD §8.3/§9.2) — every match at any turf
// this owner runs (via its booking), independent of whether the owner is
// personally on the roster (module 2.6's listMyMatches is player-centric
// and would miss these).
export async function listMatchesForOwner(ownerUserId: string) {
  return sequelize.query(
    `SELECT m.*, t.turf_name FROM matches m
     JOIN bookings b ON b.booking_id = m.booking_id
     JOIN turfs t ON t.turf_id = b.turf_id
     WHERE t.owner_id = :ownerUserId
     ORDER BY m.scheduled_start_time DESC`,
    { type: QueryTypes.SELECT, replacements: { ownerUserId } },
  );
}

// Payments incl. Cash Reconciliation (module 2.12, PRD §8.3/§9.2) — every
// payment against a booking at any turf this owner runs, across all modes.
export async function listPaymentsForOwner(ownerUserId: string) {
  return sequelize.query(
    `SELECT DISTINCT p.*, t.turf_name FROM payments p
     JOIN payment_allocations pa ON pa.payment_id = p.payment_id
     JOIN payment_obligations o ON o.obligation_id = pa.obligation_id
     JOIN bookings b ON b.booking_id = o.booking_id
     JOIN turfs t ON t.turf_id = b.turf_id
     WHERE t.owner_id = :ownerUserId
     ORDER BY p.initiated_at DESC`,
    { type: QueryTypes.SELECT, replacements: { ownerUserId } },
  );
}
