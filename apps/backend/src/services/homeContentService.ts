import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { writeAuditLog } from './auditLogService';

// Home content (AW-13, PRD §9.1 / Backlog E-7): beyond banners, the admin pins
// featured offers, turfs and tournaments, and writes short announcements, for the
// app's Home screen. Items point at live records, so a card whose offer has
// expired or whose turf was suspended simply stops appearing — nothing to clean up.

export class HomeContentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HomeContentError';
  }
}

export type HomeItemKind = 'OFFER' | 'TURF' | 'TOURNAMENT' | 'ANNOUNCEMENT';

export interface HomeItemInput {
  kind: HomeItemKind;
  ref_id?: string | null;
  title?: string | null;
  body?: string | null;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

interface ItemRow {
  item_id: string;
  kind: HomeItemKind;
  ref_id: string | null;
  title: string | null;
  body: string | null;
  link_url: string | null;
  display_order: number;
  is_active: number | boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
}

const q = <T extends object>(sql: string, replacements: Record<string, unknown> = {}) =>
  sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements });

async function refLabels(items: ItemRow[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const ids = (kind: HomeItemKind) =>
    items.filter((i) => i.kind === kind && i.ref_id).map((i) => i.ref_id as string);
  const offers = ids('OFFER');
  const turfs = ids('TURF');
  const tournaments = ids('TOURNAMENT');
  if (offers.length) {
    for (const r of await q<{ id: string; label: string }>(
      'SELECT promo_code_id AS id, code AS label FROM promo_codes WHERE promo_code_id IN (:ids)',
      { ids: offers },
    ))
      labels.set(r.id, r.label);
  }
  if (turfs.length) {
    for (const r of await q<{ id: string; label: string }>(
      'SELECT turf_id AS id, turf_name AS label FROM turfs WHERE turf_id IN (:ids)',
      { ids: turfs },
    ))
      labels.set(r.id, r.label);
  }
  if (tournaments.length) {
    for (const r of await q<{ id: string; label: string }>(
      'SELECT tournament_id AS id, name AS label FROM tournaments WHERE tournament_id IN (:ids)',
      { ids: tournaments },
    ))
      labels.set(r.id, r.label);
  }
  return labels;
}

export async function adminListItems() {
  const items = await q<ItemRow>(
    'SELECT * FROM home_content_items ORDER BY display_order ASC, created_at DESC',
  );
  const labels = await refLabels(items);
  return items.map((i) => ({
    ...i,
    is_active: Boolean(i.is_active),
    ref_label: i.ref_id ? (labels.get(i.ref_id) ?? null) : null,
  }));
}

async function assertRefExists(kind: HomeItemKind, refId: string) {
  const table = {
    OFFER: ['promo_codes', 'promo_code_id'],
    TURF: ['turfs', 'turf_id'],
    TOURNAMENT: ['tournaments', 'tournament_id'],
  }[kind as 'OFFER' | 'TURF' | 'TOURNAMENT'];
  const [row] = await q<{ x: string }>(
    `SELECT ${table[1]} AS x FROM ${table[0]} WHERE ${table[1]} = :refId`,
    { refId },
  );
  if (!row) {
    throw new HomeContentError(
      `That ${kind === 'OFFER' ? 'offer' : kind === 'TURF' ? 'turf' : 'tournament'} was not found.`,
      404,
    );
  }
}

function validate(input: HomeItemInput) {
  if (input.kind === 'ANNOUNCEMENT') {
    if (!input.title?.trim()) throw new HomeContentError('An announcement needs a title.', 400);
  } else if (!input.ref_id) {
    throw new HomeContentError('Choose what to feature.', 400);
  }
  if (input.starts_at && input.ends_at && input.ends_at < input.starts_at) {
    throw new HomeContentError('The end must be after the start.', 400);
  }
}

export async function createItem(actorUserId: string, input: HomeItemInput) {
  validate(input);
  if (input.kind !== 'ANNOUNCEMENT') await assertRefExists(input.kind, input.ref_id as string);
  const id = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('home_content_items', [
    {
      item_id: id,
      kind: input.kind,
      ref_id: input.kind === 'ANNOUNCEMENT' ? null : (input.ref_id ?? null),
      title: input.title?.trim() || null,
      body: input.body?.trim() || null,
      link_url: input.link_url?.trim() || null,
      display_order: input.display_order ?? 0,
      is_active: input.is_active ?? true,
      starts_at: input.starts_at ? new Date(input.starts_at) : null,
      ends_at: input.ends_at ? new Date(input.ends_at) : null,
      created_by: actorUserId,
      created_at: now,
      updated_at: now,
    },
  ]);
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'HOME_ITEM_CREATED',
    resourceType: 'home_content_item',
    resourceId: id,
    afterData: { kind: input.kind },
  });
  return (await adminListItems()).find((i) => i.item_id === id);
}

async function assertItem(itemId: string): Promise<ItemRow> {
  const [row] = await q<ItemRow>('SELECT * FROM home_content_items WHERE item_id = :itemId', {
    itemId,
  });
  if (!row) throw new HomeContentError('Item not found.', 404);
  return row;
}

export async function updateItem(
  actorUserId: string,
  itemId: string,
  changes: Partial<HomeItemInput>,
) {
  const existing = await assertItem(itemId);
  const values: Record<string, unknown> = {};
  for (const key of ['title', 'body', 'link_url', 'display_order', 'is_active'] as const) {
    if (changes[key] !== undefined)
      values[key] =
        typeof changes[key] === 'string' ? (changes[key] as string).trim() || null : changes[key];
  }
  if (changes.ref_id !== undefined && existing.kind !== 'ANNOUNCEMENT') {
    if (!changes.ref_id) throw new HomeContentError('Choose what to feature.', 400);
    await assertRefExists(existing.kind, changes.ref_id);
    values.ref_id = changes.ref_id;
  }
  if (changes.starts_at !== undefined)
    values.starts_at = changes.starts_at ? new Date(changes.starts_at) : null;
  if (changes.ends_at !== undefined)
    values.ends_at = changes.ends_at ? new Date(changes.ends_at) : null;
  if (existing.kind === 'ANNOUNCEMENT' && 'title' in values && !values.title) {
    throw new HomeContentError('An announcement needs a title.', 400);
  }
  if (Object.keys(values).length > 0) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate('home_content_items', { ...values, updated_at: new Date() }, { item_id: itemId });
    await writeAuditLog({
      actorUserId,
      actorRole: 'ADMIN',
      action: 'HOME_ITEM_UPDATED',
      resourceType: 'home_content_item',
      resourceId: itemId,
      afterData: values,
    });
  }
  return (await adminListItems()).find((i) => i.item_id === itemId);
}

export async function deleteItem(actorUserId: string, itemId: string) {
  await assertItem(itemId);
  await sequelize.getQueryInterface().bulkDelete('home_content_items', { item_id: itemId });
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'HOME_ITEM_DELETED',
    resourceType: 'home_content_item',
    resourceId: itemId,
  });
}

// ---- What the app shows ---------------------------------------------------------------

export async function publicContent(now = new Date()) {
  const items = await q<ItemRow>(
    `SELECT * FROM home_content_items
     WHERE is_active = TRUE AND (starts_at IS NULL OR starts_at <= :now) AND (ends_at IS NULL OR ends_at > :now)
     ORDER BY display_order ASC, created_at DESC LIMIT 40`,
    { now },
  );
  const refs = (kind: HomeItemKind) =>
    items.filter((i) => i.kind === kind && i.ref_id).map((i) => i.ref_id as string);

  const offerIds = refs('OFFER');
  const turfIds = refs('TURF');
  const tournamentIds = refs('TOURNAMENT');

  const offers = offerIds.length
    ? await q<{
        promo_code_id: string;
        code: string;
        discount_type: 'PERCENTAGE' | 'FLAT';
        discount_value: number | string;
        max_discount_amount: number | string | null;
        min_booking_amount: number | string;
        valid_until: Date | null;
      }>(
        `SELECT promo_code_id, code, discount_type, discount_value, max_discount_amount, min_booking_amount, valid_until
         FROM promo_codes
         WHERE promo_code_id IN (:ids) AND is_active = TRUE
           AND (valid_from IS NULL OR valid_from <= :now) AND (valid_until IS NULL OR valid_until > :now)`,
        { ids: offerIds, now },
      )
    : [];
  const turfs = turfIds.length
    ? await q<{ turf_id: string; turf_name: string; city: string; average_rating: string | null }>(
        "SELECT turf_id, turf_name, city, average_rating FROM turfs WHERE turf_id IN (:ids) AND turf_status = 'ACTIVE' AND deleted_at IS NULL",
        { ids: turfIds },
      )
    : [];
  const tournaments = tournamentIds.length
    ? await q<{
        tournament_id: string;
        name: string;
        entry_fee: number | string;
        start_date: string | null;
        status: string;
      }>(
        "SELECT tournament_id, name, entry_fee, start_date, status FROM tournaments WHERE tournament_id IN (:ids) AND status IN ('REGISTRATION_OPEN', 'IN_PROGRESS') AND deleted_at IS NULL",
        { ids: tournamentIds },
      )
    : [];

  const out: {
    offers: Record<string, unknown>[];
    turfs: Record<string, unknown>[];
    tournaments: Record<string, unknown>[];
    announcements: Record<string, unknown>[];
  } = { offers: [], turfs: [], tournaments: [], announcements: [] };

  for (const item of items) {
    if (item.kind === 'OFFER') {
      const o = offers.find((x) => x.promo_code_id === item.ref_id);
      if (!o) continue;
      const value = Number(o.discount_value);
      out.offers.push({
        item_id: item.item_id,
        code: o.code,
        label:
          o.discount_type === 'PERCENTAGE'
            ? `${value}% off${o.max_discount_amount ? ` (up to ₹${Number(o.max_discount_amount)})` : ''}`
            : `₹${value} off`,
        min_booking_amount: Number(o.min_booking_amount),
        valid_until: o.valid_until,
        title: item.title,
      });
    } else if (item.kind === 'TURF') {
      const t = turfs.find((x) => x.turf_id === item.ref_id);
      if (t) out.turfs.push({ item_id: item.item_id, ...t, title: item.title });
    } else if (item.kind === 'TOURNAMENT') {
      const t = tournaments.find((x) => x.tournament_id === item.ref_id);
      if (t)
        out.tournaments.push({
          item_id: item.item_id,
          ...t,
          entry_fee: Number(t.entry_fee),
          title: item.title,
        });
    } else {
      out.announcements.push({
        item_id: item.item_id,
        title: item.title,
        body: item.body,
        link_url: item.link_url,
      });
    }
  }
  return out;
}
