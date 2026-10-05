import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { writeAuditLog } from './auditLogService';

// Owner Web — Offers (OW-8, PRD §22.1): discount codes an owner creates for
// their own turfs. They are ordinary promo codes (so players enter them at
// checkout exactly like an admin code) with an owner — and optionally one turf —
// attached; checkout refuses them for bookings anywhere else.

export class OfferError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'OfferError';
  }
}

export interface OfferInput {
  code: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: number;
  max_discount_amount?: number | null;
  min_booking_amount?: number;
  usage_limit_total?: number | null;
  usage_limit_per_player?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  /** Limit the offer to one of the owner's turfs; omit for all of them. */
  turf_id?: string | null;
}

export interface Offer {
  promo_code_id: string;
  code: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: number;
  max_discount_amount: number | null;
  min_booking_amount: number;
  usage_limit_total: number | null;
  usage_limit_per_player: number | null;
  valid_from: Date | null;
  valid_until: Date | null;
  is_active: boolean;
  turf_id: string | null;
  turf_name: string | null;
  redeemed: number;
  created_at: Date;
}

const SELECT = `SELECT p.*, t.turf_name,
    (SELECT COUNT(*) FROM promo_code_redemptions r WHERE r.promo_code_id = p.promo_code_id) AS redeemed
  FROM promo_codes p LEFT JOIN turfs t ON t.turf_id = p.turf_id`;

function present(row: Record<string, unknown>): Offer {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    ...(row as unknown as Offer),
    discount_value: Number(row.discount_value),
    max_discount_amount: num(row.max_discount_amount),
    min_booking_amount: Number(row.min_booking_amount ?? 0),
    is_active: Boolean(row.is_active),
    redeemed: Number(row.redeemed ?? 0),
  };
}

async function assertOwnsTurf(ownerId: string, turfId: string) {
  const rows = await sequelize.query<{ turf_id: string }>(
    'SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :ownerId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId, ownerId } },
  );
  if (rows.length === 0) throw new OfferError('Turf not found.', 404);
}

async function loadOwned(ownerId: string, offerId: string) {
  const [row] = await sequelize.query<Record<string, unknown>>(
    `${SELECT} WHERE p.promo_code_id = :offerId AND p.owner_id = :ownerId`,
    { type: QueryTypes.SELECT, replacements: { offerId, ownerId } },
  );
  if (!row) throw new OfferError('Offer not found.', 404);
  return row;
}

function assertRules(input: Partial<OfferInput>, type: 'PERCENTAGE' | 'FLAT') {
  if (input.discount_value !== undefined && type === 'PERCENTAGE' && input.discount_value > 100) {
    throw new OfferError('A percentage discount cannot be more than 100.', 400);
  }
  if (input.valid_from && input.valid_until && input.valid_until < input.valid_from) {
    throw new OfferError('The end date must be after the start date.', 400);
  }
}

export async function listOffers(ownerId: string): Promise<Offer[]> {
  const rows = await sequelize.query<Record<string, unknown>>(
    `${SELECT} WHERE p.owner_id = :ownerId ORDER BY p.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { ownerId } },
  );
  return rows.map(present);
}

export async function createOffer(ownerId: string, input: OfferInput): Promise<Offer> {
  assertRules(input, input.discount_type);
  if (input.turf_id) await assertOwnsTurf(ownerId, input.turf_id);
  const code = input.code.trim().toUpperCase();
  const [taken] = await sequelize.query<{ promo_code_id: string }>(
    'SELECT promo_code_id FROM promo_codes WHERE code = :code',
    { type: QueryTypes.SELECT, replacements: { code } },
  );
  if (taken) throw new OfferError('That code is already in use. Choose another.', 409);

  const id = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('promo_codes', [
    {
      promo_code_id: id,
      code,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      max_discount_amount:
        input.discount_type === 'PERCENTAGE' ? (input.max_discount_amount ?? null) : null,
      min_booking_amount: input.min_booking_amount ?? 0,
      usage_limit_total: input.usage_limit_total ?? null,
      usage_limit_per_player: input.usage_limit_per_player ?? null,
      valid_from: input.valid_from ? new Date(input.valid_from) : null,
      valid_until: input.valid_until ? new Date(input.valid_until) : null,
      is_active: true,
      created_by: ownerId,
      owner_id: ownerId,
      turf_id: input.turf_id ?? null,
      created_at: new Date(),
    },
  ]);
  await writeAuditLog({
    actorUserId: ownerId,
    actorRole: 'TURF_OWNER',
    action: 'OFFER_CREATED',
    resourceType: 'promo_code',
    resourceId: id,
    afterData: { code, turf_id: input.turf_id ?? null },
  });
  return present(await loadOwned(ownerId, id));
}

export async function updateOffer(
  ownerId: string,
  offerId: string,
  changes: Partial<Omit<OfferInput, 'code'>>,
): Promise<Offer> {
  const existing = await loadOwned(ownerId, offerId);
  const type = (changes.discount_type ?? existing.discount_type) as 'PERCENTAGE' | 'FLAT';
  assertRules(
    { ...changes, discount_value: changes.discount_value ?? Number(existing.discount_value) },
    type,
  );
  if (changes.turf_id) await assertOwnsTurf(ownerId, changes.turf_id);

  const values: Record<string, unknown> = {};
  for (const key of [
    'discount_type',
    'discount_value',
    'max_discount_amount',
    'min_booking_amount',
    'usage_limit_total',
    'usage_limit_per_player',
    'turf_id',
  ] as const) {
    if (changes[key] !== undefined) values[key] = changes[key];
  }
  if (changes.valid_from !== undefined)
    values.valid_from = changes.valid_from ? new Date(changes.valid_from) : null;
  if (changes.valid_until !== undefined)
    values.valid_until = changes.valid_until ? new Date(changes.valid_until) : null;
  if (Object.keys(values).length > 0) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate('promo_codes', values, { promo_code_id: offerId });
  }
  return present(await loadOwned(ownerId, offerId));
}

export async function setOfferActive(
  ownerId: string,
  offerId: string,
  active: boolean,
): Promise<Offer> {
  await loadOwned(ownerId, offerId);
  await sequelize
    .getQueryInterface()
    .bulkUpdate('promo_codes', { is_active: active }, { promo_code_id: offerId });
  return present(await loadOwned(ownerId, offerId));
}

export async function deleteOffer(ownerId: string, offerId: string): Promise<void> {
  const existing = await loadOwned(ownerId, offerId);
  if (Number(existing.redeemed) > 0) {
    throw new OfferError(
      'Players have already used this offer. Switch it off instead of deleting it.',
      409,
    );
  }
  await sequelize.getQueryInterface().bulkDelete('promo_codes', { promo_code_id: offerId });
}
