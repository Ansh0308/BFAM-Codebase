import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { writeAuditLog } from './auditLogService';

// Admin Web — hands-on data management: bookings across every turf, promo
// code edit/delete, turf deletion, and the Data Explorer (browse, edit and
// delete rows in any table, with secrets masked and a few tables locked).
// Every write is audited under the admin's id.

export class AdminManageError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AdminManageError';
  }
}

// ---- Bookings -------------------------------------------------------------

const MAX_BOOKING_RANGE_DAYS = 92;

export async function adminListBookings(filters: { from: string; to: string; turfId?: string }) {
  const span =
    (new Date(`${filters.to}T00:00:00Z`).getTime() -
      new Date(`${filters.from}T00:00:00Z`).getTime()) /
    86_400_000;
  if (Number.isNaN(span) || span < 0 || span > MAX_BOOKING_RANGE_DAYS) {
    throw new AdminManageError(
      `Choose a date range of at most ${MAX_BOOKING_RANGE_DAYS} days.`,
      400,
    );
  }
  return sequelize.query(
    `SELECT b.*, t.turf_name, ou.phone_number AS owner_phone,
            u.phone_number AS customer_phone, pl.full_name AS customer_name,
            COALESCE((SELECT SUM(o.amount_due) FROM payment_obligations o
                      WHERE o.booking_id = b.booking_id AND o.due_status <> 'CANCELLED'), 0) AS amount_due,
            COALESCE((SELECT SUM(o.amount_due) FROM payment_obligations o
                      WHERE o.booking_id = b.booking_id AND o.due_status = 'PAID'), 0) AS amount_paid
     FROM bookings b
     JOIN turfs t ON t.turf_id = b.turf_id
     LEFT JOIN users ou ON ou.user_id = t.owner_id
     LEFT JOIN users u ON u.user_id = b.booked_by
     LEFT JOIN players pl ON pl.user_id = b.booked_by
     WHERE b.booking_date BETWEEN :from AND :to
       ${filters.turfId ? 'AND b.turf_id = :turfId' : ''}
     ORDER BY b.booking_date DESC, b.start_time ASC
     LIMIT 1000`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        from: filters.from,
        to: filters.to,
        ...(filters.turfId ? { turfId: filters.turfId } : {}),
      },
    },
  );
}

// Administrative correction of a booking's status (e.g. mark a played slot
// COMPLETED). Cancelling should still go through POST /bookings/:id/cancel,
// which frees the slot and handles the booking's side effects.
export async function adminSetBookingStatus(
  actorUserId: string,
  bookingId: string,
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED',
) {
  const [booking] = await sequelize.query<{ booking_status: string }>(
    'SELECT booking_status FROM bookings WHERE booking_id = :bookingId',
    { type: QueryTypes.SELECT, replacements: { bookingId } },
  );
  if (!booking) throw new AdminManageError('Booking not found.', 404);
  if (booking.booking_status === 'CANCELLED') {
    throw new AdminManageError('A cancelled booking cannot be reopened here.', 409);
  }
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'bookings',
      { booking_status: status, updated_at: new Date() },
      { booking_id: bookingId },
    );
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'BOOKING_STATUS_CHANGED',
    resourceType: 'booking',
    resourceId: bookingId,
    beforeData: { booking_status: booking.booking_status },
    afterData: { booking_status: status },
  });
  return { booking_id: bookingId, booking_status: status };
}

// ---- Promo codes ------------------------------------------------------------

export interface UpdatePromoInput {
  discount_type?: 'PERCENTAGE' | 'FLAT';
  discount_value?: number;
  max_discount_amount?: number | null;
  min_booking_amount?: number;
  usage_limit_total?: number | null;
  usage_limit_per_player?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
}

export async function adminUpdatePromoCode(
  actorUserId: string,
  promoCodeId: string,
  input: UpdatePromoInput,
) {
  const [before] = await sequelize.query<Record<string, unknown>>(
    'SELECT * FROM promo_codes WHERE promo_code_id = :promoCodeId',
    { type: QueryTypes.SELECT, replacements: { promoCodeId } },
  );
  if (!before) throw new AdminManageError('Promo code not found.', 404);

  const changes: Record<string, unknown> = {};
  for (const key of [
    'discount_type',
    'discount_value',
    'max_discount_amount',
    'min_booking_amount',
    'usage_limit_total',
    'usage_limit_per_player',
  ] as const) {
    if (input[key] !== undefined) changes[key] = input[key];
  }
  if (input.valid_from !== undefined)
    changes.valid_from = input.valid_from ? new Date(input.valid_from) : null;
  if (input.valid_until !== undefined)
    changes.valid_until = input.valid_until ? new Date(input.valid_until) : null;
  if (Object.keys(changes).length === 0) throw new AdminManageError('Nothing to change.', 400);

  await sequelize
    .getQueryInterface()
    .bulkUpdate('promo_codes', changes, { promo_code_id: promoCodeId });
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'PROMO_CODE_UPDATED',
    resourceType: 'promo_code',
    resourceId: promoCodeId,
    beforeData: Object.fromEntries(Object.keys(changes).map((k) => [k, before[k] ?? null])),
    afterData: input,
  });
  return { promo_code_id: promoCodeId };
}

export async function adminDeletePromoCode(actorUserId: string, promoCodeId: string) {
  const [before] = await sequelize.query<{ code: string }>(
    'SELECT code FROM promo_codes WHERE promo_code_id = :promoCodeId',
    { type: QueryTypes.SELECT, replacements: { promoCodeId } },
  );
  if (!before) throw new AdminManageError('Promo code not found.', 404);
  try {
    await sequelize.getQueryInterface().bulkDelete('promo_codes', { promo_code_id: promoCodeId });
  } catch {
    // Redemptions reference the code; keep their history and just switch it off instead.
    throw new AdminManageError(
      'This code has been redeemed, so it can’t be deleted. Switch it off instead.',
      409,
    );
  }
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'PROMO_CODE_DELETED',
    resourceType: 'promo_code',
    resourceId: promoCodeId,
    beforeData: { code: before.code },
  });
}

// ---- Turfs --------------------------------------------------------------------

// Soft delete. Refuses while there are upcoming live bookings so nobody's
// slot disappears from under them.
export async function adminDeleteTurf(actorUserId: string, turfId: string) {
  const [turf] = await sequelize.query<{ turf_name: string }>(
    'SELECT turf_name FROM turfs WHERE turf_id = :turfId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (!turf) throw new AdminManageError('Turf not found.', 404);

  const [upcoming] = await sequelize.query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM bookings
     WHERE turf_id = :turfId AND booking_status IN ('PENDING', 'CONFIRMED')
       AND booking_date >= DATE(UTC_TIMESTAMP())`,
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (Number(upcoming?.n ?? 0) > 0) {
    throw new AdminManageError(
      'This turf has upcoming bookings. Cancel them first, or suspend the turf instead.',
      409,
    );
  }

  const now = new Date();
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turfs',
      { deleted_at: now, turf_status: 'INACTIVE', updated_at: now },
      { turf_id: turfId },
    );
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'TURF_DELETED',
    resourceType: 'turf',
    resourceId: turfId,
    beforeData: { turf_name: turf.turf_name },
  });
}

// ---- Data Explorer ------------------------------------------------------------

// Tables that are never listed (credentials, tokens, migration bookkeeping).
const HIDDEN_TABLE = /^sequelize|otp|token|session/i;
// Visible but read-only: the audit trail and gateway event logs.
const READ_ONLY_TABLES = new Set(['audit_logs', 'payment_events']);
// Columns whose values are never shown or written.
const SECRET_COLUMN = /password|secret|hash|token|otp/i;

interface ColumnInfo {
  name: string;
  type: string;
  dataType: string;
  nullable: boolean;
  isPrimary: boolean;
  masked: boolean;
}

export interface ExplorerTable {
  name: string;
  rows: number;
  read_only: boolean;
}

export async function explorerListTables(): Promise<ExplorerTable[]> {
  const rows = await sequelize.query<{ name: string; n: number | string | null }>(
    `SELECT TABLE_NAME AS name, TABLE_ROWS AS n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME`,
    { type: QueryTypes.SELECT },
  );
  return rows
    .filter((r) => !HIDDEN_TABLE.test(r.name))
    .map((r) => ({
      name: r.name,
      rows: Number(r.n ?? 0),
      read_only: READ_ONLY_TABLES.has(r.name),
    }));
}

async function loadColumns(table: string): Promise<ColumnInfo[]> {
  const tables = await explorerListTables();
  if (!tables.some((t) => t.name === table)) {
    throw new AdminManageError('Unknown table.', 404);
  }
  const rows = await sequelize.query<{
    name: string;
    col_type: string;
    data_type: string;
    nullable: string;
    col_key: string;
  }>(
    `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS col_type, DATA_TYPE AS data_type,
            IS_NULLABLE AS nullable, COLUMN_KEY AS col_key
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = :table ORDER BY ORDINAL_POSITION`,
    { type: QueryTypes.SELECT, replacements: { table } },
  );
  return rows.map((r) => ({
    name: r.name,
    type: r.col_type,
    dataType: r.data_type,
    nullable: r.nullable === 'YES',
    isPrimary: r.col_key === 'PRI',
    masked: SECRET_COLUMN.test(r.name),
  }));
}

const q = (identifier: string) => `\`${identifier.replace(/`/g, '')}\``;

export async function explorerGetRows(
  table: string,
  opts: { limit: number; offset: number; search?: string },
) {
  const columns = await loadColumns(table);
  const primary = columns.filter((c) => c.isPrimary);
  const visible = columns.filter((c) => !c.masked);
  const selectList = visible.map((c) => q(c.name)).join(', ') || '1';

  const replacements: Record<string, unknown> = { limit: opts.limit, offset: opts.offset };
  let where = '';
  if (opts.search?.trim()) {
    const textual = visible.filter((c) => /char|text|enum/.test(c.dataType)).slice(0, 8);
    if (textual.length > 0) {
      replacements.search = `%${opts.search.trim()}%`;
      where = `WHERE ${textual.map((c) => `${q(c.name)} LIKE :search`).join(' OR ')}`;
    }
  }
  const orderCol = columns.find((c) => c.name === 'created_at') ?? primary[0];
  const order = orderCol ? `ORDER BY ${q(orderCol.name)} DESC` : '';

  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT ${selectList} FROM ${q(table)} ${where} ${order} LIMIT :limit OFFSET :offset`,
    { type: QueryTypes.SELECT, replacements },
  );
  const [count] = await sequelize.query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM ${q(table)} ${where}`,
    { type: QueryTypes.SELECT, replacements },
  );
  return {
    table,
    read_only: READ_ONLY_TABLES.has(table) || primary.length !== 1,
    primary_key: primary.length === 1 ? primary[0].name : null,
    columns: columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      primary: c.isPrimary,
      masked: c.masked,
    })),
    rows,
    total: Number(count?.n ?? 0),
  };
}

async function writableContext(table: string) {
  if (READ_ONLY_TABLES.has(table)) throw new AdminManageError('This table is read-only.', 403);
  const columns = await loadColumns(table);
  const primary = columns.filter((c) => c.isPrimary);
  if (primary.length !== 1) {
    throw new AdminManageError(
      'Only tables with a single-column primary key can be edited here.',
      400,
    );
  }
  return { columns, pk: primary[0] };
}

function coerce(column: ColumnInfo, value: unknown): unknown {
  if (value === null) {
    if (!column.nullable) throw new AdminManageError(`${column.name} cannot be empty.`, 400);
    return null;
  }
  if (/^(datetime|timestamp|date)$/.test(column.dataType) && typeof value === 'string') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
      throw new AdminManageError(`${column.name} is not a valid date.`, 400);
    return column.dataType === 'date' ? value.slice(0, 10) : d;
  }
  if (column.dataType === 'json' && typeof value !== 'string') return JSON.stringify(value);
  if (typeof value === 'object')
    throw new AdminManageError(`${column.name} must be a simple value.`, 400);
  return value;
}

async function fetchRow(table: string, pk: ColumnInfo, id: string) {
  const [row] = await sequelize.query<Record<string, unknown>>(
    `SELECT * FROM ${q(table)} WHERE ${q(pk.name)} = :id`,
    { type: QueryTypes.SELECT, replacements: { id } },
  );
  return row ?? null;
}

function redact(row: Record<string, unknown>, columns: ColumnInfo[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of columns) if (!c.masked && c.name in row) out[c.name] = row[c.name];
  return out;
}

export async function explorerUpdateRow(
  actorUserId: string,
  table: string,
  id: string,
  changes: Record<string, unknown>,
) {
  const { columns, pk } = await writableContext(table);
  const before = await fetchRow(table, pk, id);
  if (!before) throw new AdminManageError('Row not found.', 404);

  const values: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(changes)) {
    const col = columns.find((c) => c.name === name);
    if (!col) throw new AdminManageError(`Unknown column ${name}.`, 400);
    if (col.isPrimary) throw new AdminManageError('The primary key can’t be changed.', 400);
    if (col.masked) throw new AdminManageError(`${name} can’t be edited here.`, 403);
    values[name] = coerce(col, raw);
  }
  if (Object.keys(values).length === 0) throw new AdminManageError('Nothing to change.', 400);

  try {
    await sequelize.getQueryInterface().bulkUpdate(table, values, { [pk.name]: id });
  } catch (error) {
    throw new AdminManageError(
      error instanceof Error
        ? `The database refused that change: ${error.message}`
        : 'The database refused that change.',
      409,
    );
  }
  const after = await fetchRow(table, pk, id);
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'DATA_ROW_UPDATED',
    resourceType: table,
    resourceId: id,
    beforeData: redact(before, columns),
    afterData: redact(after ?? {}, columns),
  });
  return redact(after ?? {}, columns);
}

export async function explorerDeleteRow(actorUserId: string, table: string, id: string) {
  const { columns, pk } = await writableContext(table);
  const before = await fetchRow(table, pk, id);
  if (!before) throw new AdminManageError('Row not found.', 404);
  try {
    await sequelize.getQueryInterface().bulkDelete(table, { [pk.name]: id });
  } catch {
    throw new AdminManageError(
      'Other records still reference this row, so it can’t be deleted. Remove or change those first.',
      409,
    );
  }
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'DATA_ROW_DELETED',
    resourceType: table,
    resourceId: id,
    beforeData: redact(before, columns),
  });
}

// Insert a new row. A missing char(36) primary key is generated, and
// created_at / updated_at are filled in when the table has them.
export async function explorerInsertRow(
  actorUserId: string,
  table: string,
  values: Record<string, unknown>,
) {
  const { columns, pk } = await writableContext(table);
  const row: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(values)) {
    const col = columns.find((c) => c.name === name);
    if (!col) throw new AdminManageError(`Unknown column ${name}.`, 400);
    if (col.masked) throw new AdminManageError(`${name} can’t be set here.`, 403);
    row[name] = coerce(col, raw);
  }
  if (row[pk.name] === undefined) {
    if (/char\(36\)/i.test(pk.type)) row[pk.name] = randomUUID();
    else if (!/auto_increment/i.test(pk.type)) {
      throw new AdminManageError(`Provide a value for ${pk.name}.`, 400);
    }
  }
  const now = new Date();
  for (const stamp of ['created_at', 'updated_at']) {
    if (row[stamp] === undefined && columns.some((c) => c.name === stamp)) row[stamp] = now;
  }

  try {
    await sequelize.getQueryInterface().bulkInsert(table, [row]);
  } catch (error) {
    throw new AdminManageError(
      error instanceof Error
        ? `The database refused that row: ${error.message}`
        : 'The database refused that row.',
      409,
    );
  }
  const id = row[pk.name] !== undefined ? String(row[pk.name]) : '';
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'DATA_ROW_CREATED',
    resourceType: table,
    resourceId: id || 'new',
    afterData: redact(row, columns),
  });
  return { id };
}
