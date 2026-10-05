import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { InvalidTurfStateError, TurfNotFoundError } from '../domain/errors';
import { writeAuditLog } from './auditLogService';
import { sendNotification } from './notificationService';

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
  rejection_reason: string | null;
  created_at: Date;
}

export async function listAllTurfsForAdmin(): Promise<AdminTurfRow[]> {
  return sequelize.query<AdminTurfRow>(
    `SELECT t.turf_id, t.turf_name, t.city, t.turf_status, t.average_rating,
            t.owner_id, p.full_name AS owner_name, u.phone_number AS owner_phone,
            t.rejection_reason, t.created_at
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

// Turf approval (AW-11, PRD §30.10): a turf an owner creates waits here until an
// admin approves it (it then becomes visible to players) or rejects it with a
// reason the owner can read.
async function loadPendingTurf(turfId: string) {
  const [turf] = await sequelize.query<{
    turf_status: string;
    owner_id: string;
    turf_name: string;
  }>(
    'SELECT turf_status, owner_id, turf_name FROM turfs WHERE turf_id = :turfId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  if (!turf) throw new TurfNotFoundError(turfId);
  if (turf.turf_status !== 'PENDING_APPROVAL' && turf.turf_status !== 'REJECTED') {
    throw new InvalidTurfStateError('This turf is not waiting for approval.');
  }
  return turf;
}

export async function approveTurf(turfId: string, actorUserId: string): Promise<AdminTurfRow> {
  const turf = await loadPendingTurf(turfId);
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turfs',
      { turf_status: 'ACTIVE', rejection_reason: null, updated_at: new Date() },
      { turf_id: turfId },
    );
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'TURF_APPROVED',
    resourceType: 'turf',
    resourceId: turfId,
    beforeData: { turf_status: turf.turf_status },
    afterData: { turf_status: 'ACTIVE' },
  });
  await sendNotification({
    userId: turf.owner_id,
    event: 'TURF_UPDATE',
    params: { message: `${turf.turf_name} has been approved and is now live for players.` },
    relatedEntityType: 'turf',
    relatedEntityId: turfId,
  });
  return (await listAllTurfsForAdmin()).filter((r) => r.turf_id === turfId)[0];
}

export async function rejectTurf(
  turfId: string,
  actorUserId: string,
  reason: string,
): Promise<AdminTurfRow> {
  const turf = await loadPendingTurf(turfId);
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turfs',
      { turf_status: 'REJECTED', rejection_reason: reason, updated_at: new Date() },
      { turf_id: turfId },
    );
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'TURF_REJECTED',
    resourceType: 'turf',
    resourceId: turfId,
    beforeData: { turf_status: turf.turf_status },
    afterData: { turf_status: 'REJECTED', reason },
  });
  await sendNotification({
    userId: turf.owner_id,
    event: 'TURF_UPDATE',
    params: { message: `${turf.turf_name} was not approved: ${reason}` },
    relatedEntityType: 'turf',
    relatedEntityId: turfId,
  });
  return (await listAllTurfsForAdmin()).filter((r) => r.turf_id === turfId)[0];
}
