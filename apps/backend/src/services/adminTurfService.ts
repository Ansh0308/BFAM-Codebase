import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { TurfNotFoundError } from '../domain/errors';
import { writeAuditLog } from './auditLogService';

// Backlog E-3 — Turf Management in Admin Web (PRD §9.1). Owner Web already
// has a full turf-management hub (pricing, hours, blocks, sound, copy-
// details) scoped to "turfs I own" — duplicating all of that for Admin
// would mean re-implementing the same UI for no real gain, since an admin
// has no legitimate reason to edit a turf's pricing or hours on an owner's
// behalf. What Admin Web actually needs and doesn't have anywhere today:
// a cross-owner directory of every turf, and the ability to moderate one
// (ACTIVE/INACTIVE/SUSPENDED) — turf_status has existed in the schema
// since phase 1 but nothing anywhere ever sets it to anything but ACTIVE.
export interface AdminTurfRow {
  turf_id: string;
  turf_name: string;
  city: string;
  turf_status: string;
  average_rating: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_phone: string;
  created_at: Date;
}

export async function listAllTurfsForAdmin(): Promise<AdminTurfRow[]> {
  return sequelize.query<AdminTurfRow>(
    `SELECT t.turf_id, t.turf_name, t.city, t.turf_status, t.average_rating,
            t.owner_id, p.full_name AS owner_name, u.phone_number AS owner_phone,
            t.created_at
     FROM turfs t
     JOIN users u ON u.user_id = t.owner_id
     LEFT JOIN players p ON p.user_id = u.user_id
     WHERE t.deleted_at IS NULL
     ORDER BY t.created_at DESC`,
    { type: QueryTypes.SELECT },
  );
}

export async function setTurfStatusAsAdmin(
  turfId: string,
  newStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  actorUserId: string,
): Promise<AdminTurfRow> {
  const [turf] = await sequelize.query<{ turf_status: string }>(
    'SELECT turf_status FROM turfs WHERE turf_id = :turfId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (!turf) throw new TurfNotFoundError(turfId);

  await sequelize
    .getQueryInterface()
    .bulkUpdate('turfs', { turf_status: newStatus, updated_at: new Date() }, { turf_id: turfId });

  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'TURF_STATUS_CHANGED',
    resourceType: 'turf',
    resourceId: turfId,
    beforeData: { turf_status: turf.turf_status },
    afterData: { turf_status: newStatus },
  });

  const [updated] = await listAllTurfsForAdmin().then((rows) =>
    rows.filter((r) => r.turf_id === turfId),
  );
  return updated;
}
