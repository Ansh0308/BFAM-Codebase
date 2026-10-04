import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { IST_TODAY_SQL } from '../domain/time';
import { writeAuditLog } from './auditLogService';

// Admin Web console data (PRD §9.1 / §30.10): the platform overview, the
// support-ticket queue, the audit-log viewer and promo-code switches. Reads
// are cross-user by design — every route that calls into here is ADMIN-only.

async function count(sql: string, replacements: Record<string, unknown> = {}): Promise<number> {
  const [row] = await sequelize.query<{ n: number | string }>(sql, {
    type: QueryTypes.SELECT,
    replacements,
  });
  return Number(row?.n ?? 0);
}

async function sum(sql: string): Promise<number> {
  const [row] = await sequelize.query<{ n: number | string | null }>(sql, {
    type: QueryTypes.SELECT,
  });
  return Number(row?.n ?? 0);
}

export interface AuditLogRow {
  log_id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_phone: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  before_data: unknown;
  after_data: unknown;
  created_at: Date;
}

// MySQL JSON columns can come back as text or already-parsed, depending on
// the driver settings — normalise so the client always gets an object.
function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function listAuditLogs(filters: {
  resourceType?: string;
  action?: string;
  limit: number;
  offset: number;
}): Promise<{ results: AuditLogRow[]; total: number }> {
  const where: string[] = [];
  const replacements: Record<string, unknown> = { limit: filters.limit, offset: filters.offset };
  if (filters.resourceType) {
    where.push('l.resource_type = :resourceType');
    replacements.resourceType = filters.resourceType;
  }
  if (filters.action) {
    where.push('l.action = :action');
    replacements.action = filters.action;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await sequelize.query<AuditLogRow>(
    `SELECT l.*, u.phone_number AS actor_phone
     FROM audit_logs l
     LEFT JOIN users u ON u.user_id = l.actor_user_id
     ${clause}
     ORDER BY l.created_at DESC
     LIMIT :limit OFFSET :offset`,
    { type: QueryTypes.SELECT, replacements },
  );
  const total = await count(`SELECT COUNT(*) AS n FROM audit_logs l ${clause}`, replacements);
  return {
    results: rows.map((r) => ({
      ...r,
      before_data: parseJson(r.before_data),
      after_data: parseJson(r.after_data),
    })),
    total,
  };
}

export interface AdminOverview {
  users: { players: number; owners: number; staff: number; new_players_7d: number };
  turfs: { active: number; total: number };
  bookings: { today: number; last_7_days: number };
  revenue: { last_30_days: number };
  matches: { live: number; upcoming: number };
  support: { open: number; in_progress: number };
  bfam_ids: { locked: number };
  recent_activity: AuditLogRow[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    players,
    owners,
    staff,
    newPlayers,
    activeTurfs,
    totalTurfs,
    bookingsToday,
    bookings7,
    revenue30,
    liveMatches,
    upcomingMatches,
    openTickets,
    inProgressTickets,
    lockedIds,
    recent,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'PLAYER' AND deleted_at IS NULL"),
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'TURF_OWNER' AND deleted_at IS NULL"),
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'TURF_STAFF' AND deleted_at IS NULL"),
    count(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'PLAYER' AND deleted_at IS NULL AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)",
    ),
    count("SELECT COUNT(*) AS n FROM turfs WHERE turf_status = 'ACTIVE' AND deleted_at IS NULL"),
    count('SELECT COUNT(*) AS n FROM turfs WHERE deleted_at IS NULL'),
    count(`SELECT COUNT(*) AS n FROM bookings WHERE booking_date = ${IST_TODAY_SQL}`),
    count(
      `SELECT COUNT(*) AS n FROM bookings WHERE booking_date > DATE_SUB(${IST_TODAY_SQL}, INTERVAL 7 DAY)`,
    ),
    sum(
      "SELECT SUM(amount) AS n FROM payments WHERE payment_status = 'SUCCESS' AND completed_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)",
    ),
    count("SELECT COUNT(*) AS n FROM matches WHERE match_status = 'IN_PROGRESS'"),
    count(
      "SELECT COUNT(*) AS n FROM matches WHERE match_status IN ('OPEN', 'PENDING', 'CONFIRMED')",
    ),
    count("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'OPEN'"),
    count("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'IN_PROGRESS'"),
    count("SELECT COUNT(*) AS n FROM reserved_bfam_ids WHERE status = 'LOCKED'"),
    listAuditLogs({ limit: 6, offset: 0 }),
  ]);

  return {
    users: { players, owners, staff, new_players_7d: newPlayers },
    turfs: { active: activeTurfs, total: totalTurfs },
    bookings: { today: bookingsToday, last_7_days: bookings7 },
    revenue: { last_30_days: revenue30 },
    matches: { live: liveMatches, upcoming: upcomingMatches },
    support: { open: openTickets, in_progress: inProgressTickets },
    bfam_ids: { locked: lockedIds },
    recent_activity: recent.results,
  };
}

export interface AdminTicketRow {
  ticket_id: string;
  raised_by: string;
  raised_by_phone: string | null;
  raised_by_name: string | null;
  raised_by_bfam_id: string | null;
  category: string;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  dispute_type: 'COMPLAINT' | 'MATCH_DISPUTE' | 'INJURY_REPORT';
  assigned_to: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

// The whole queue (capped), open work first. `counts` is over every ticket,
// not just the filtered page, so the status tabs always show the real totals.
export async function listTicketsForAdmin(filters: { status?: string; disputeType?: string }) {
  const where: string[] = [];
  const replacements: Record<string, unknown> = {};
  if (filters.status) {
    where.push('t.status = :status');
    replacements.status = filters.status;
  }
  if (filters.disputeType) {
    where.push('t.dispute_type = :disputeType');
    replacements.disputeType = filters.disputeType;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const results = await sequelize.query<AdminTicketRow>(
    `SELECT t.*, u.phone_number AS raised_by_phone, p.full_name AS raised_by_name,
            p.bfam_id AS raised_by_bfam_id
     FROM support_tickets t
     LEFT JOIN users u ON u.user_id = t.raised_by
     LEFT JOIN players p ON p.user_id = t.raised_by
     ${clause}
     ORDER BY FIELD(t.status, 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'), t.created_at DESC
     LIMIT 200`,
    { type: QueryTypes.SELECT, replacements },
  );

  const grouped = await sequelize.query<{ status: string; n: number | string }>(
    'SELECT status, COUNT(*) AS n FROM support_tickets GROUP BY status',
    { type: QueryTypes.SELECT },
  );
  const counts: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
  for (const g of grouped) counts[g.status] = Number(g.n);

  return { results, counts };
}

export class PromoCodeNotFoundError extends Error {
  constructor() {
    super('Promo code not found.');
    this.name = 'PromoCodeNotFoundError';
  }
}

// Switch a promo code on or off without deleting it (existing redemptions
// keep their history).
export async function setPromoCodeActive(
  promoCodeId: string,
  isActive: boolean,
  actorUserId: string,
): Promise<{ promo_code_id: string; is_active: boolean }> {
  const [existing] = await sequelize.query<{ code: string; is_active: boolean | number }>(
    'SELECT code, is_active FROM promo_codes WHERE promo_code_id = :promoCodeId',
    { type: QueryTypes.SELECT, replacements: { promoCodeId } },
  );
  if (!existing) throw new PromoCodeNotFoundError();

  await sequelize
    .getQueryInterface()
    .bulkUpdate('promo_codes', { is_active: isActive }, { promo_code_id: promoCodeId });
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'PROMO_CODE_TOGGLED',
    resourceType: 'promo_code',
    resourceId: promoCodeId,
    beforeData: { code: existing.code, is_active: Boolean(existing.is_active) },
    afterData: { code: existing.code, is_active: isActive },
  });
  return { promo_code_id: promoCodeId, is_active: isActive };
}
