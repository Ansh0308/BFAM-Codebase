import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { ForbiddenActionError, TurfNotFoundError } from '../domain/errors';

interface TurfRow {
  turf_id: string;
  owner_id: string;
}

async function fetchTurfOrThrow(turfId: string): Promise<TurfRow> {
  const [turf] = await sequelize.query<TurfRow>(
    'SELECT turf_id, owner_id FROM turfs WHERE turf_id = :turfId AND deleted_at IS NULL',
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

// Owner Dashboard (module 2.12, PRD §8.3) — every turf this owner runs.
export async function listMyTurfs(ownerUserId: string) {
  return sequelize.query(
    `SELECT * FROM turfs WHERE owner_id = :ownerUserId AND deleted_at IS NULL ORDER BY created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { ownerUserId } },
  );
}

export interface CreateTurfInput {
  turf_name: string;
  description?: string | null;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  ball_types_supported?: string[];
}

// Turf Management (module 2.12, PRD §8.3/§9.2) — the module 2.3 turfService
// only ever read turfs (discovery); this is the first owner-authoring path.
export async function createTurf(ownerUserId: string, input: CreateTurfInput) {
  const turfId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('turfs', [
    {
      turf_id: turfId,
      owner_id: ownerUserId,
      turf_name: input.turf_name,
      description: input.description ?? null,
      address_line: input.address_line,
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
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
  const [row] = await sequelize.query('SELECT * FROM turfs WHERE turf_id = :turfId', {
    type: QueryTypes.SELECT,
    replacements: { turfId },
  });
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
