import { randomUUID } from 'crypto';
import { istToday } from '../domain/time';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  ForbiddenActionError,
  StaffAssignmentNotFoundError,
  StaffNotVerifiedError,
  StaffPermissionDeniedError,
  TurfNotFoundError,
} from '../domain/errors';
import { sendNotification } from './notificationService';
import { resolveDocumentUrl } from './uploadService';
import { createStaffOwnerOrAdminAccount } from './adminUserManagement';
import { writeAuditLog } from './auditLogService';

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

export interface StaffAssignmentRow {
  assignment_id: string;
  turf_id: string;
  staff_user_id: string;
  permissions: Record<string, unknown>;
  assigned_by: string;
  status: string;
  verification_status: string;
  verification_document_url: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
}

// The database holds a private reference to a staff member's ID document, never
// a public link. Anything returned to a client swaps it for a short-lived
// signed URL so the owner can open it (and nobody else can, later).
async function presentAssignment<T extends { verification_document_url: string | null }>(
  row: T | null,
): Promise<T | null> {
  if (!row) return row;
  return {
    ...row,
    verification_document_url: await resolveDocumentUrl(row.verification_document_url),
  };
}

async function fetchAssignment(assignmentId: string): Promise<StaffAssignmentRow | null> {
  const [row] = await sequelize.query<StaffAssignmentRow>(
    'SELECT * FROM turf_staff_assignments WHERE assignment_id = :assignmentId',
    { type: QueryTypes.SELECT, replacements: { assignmentId } },
  );
  return row ?? null;
}

// Staff Management (module 2.12, PRD §8.3): owner assigns a staff account
// (already registered with role TURF_STAFF) to their turf. Starts PENDING
// verification (PRD §32.14) — see assertStaffVerified for the enforcement.
export async function assignStaff(turfId: string, ownerUserId: string, staffUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  const [staffUser] = await sequelize.query<{ role: string }>(
    'SELECT role FROM users WHERE user_id = :staffUserId AND deleted_at IS NULL',
    { type: QueryTypes.SELECT, replacements: { staffUserId } },
  );
  if (!staffUser || staffUser.role !== 'TURF_STAFF') {
    throw new ForbiddenActionError('Only an account with the Turf Staff role can be assigned.');
  }

  const assignmentId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('turf_staff_assignments', [
    {
      assignment_id: assignmentId,
      turf_id: turfId,
      staff_user_id: staffUserId,
      permissions: JSON.stringify({}),
      assigned_by: ownerUserId,
      status: 'ACTIVE',
      verification_status: 'PENDING',
      verification_document_url: null,
      verified_by: null,
      verified_at: null,
      rejection_reason: null,
      created_at: new Date(),
    },
  ]);
  return fetchAssignment(assignmentId);
}

export interface CreateStaffForTurfInput {
  phone_number: string;
  password: string;
  email?: string | null;
  /** The owner vouches for this person now, so they can check in / take cash straight away. */
  verified?: boolean;
}

// Staff Management (PRD §8.3): the owner registers a new staff member from
// their portal — creates the TURF_STAFF login and assigns it to this turf in
// one step. (Staff can no longer sign themselves up.) Verification starts
// PENDING unless the owner marks the person verified.
export async function createStaffForTurf(
  turfId: string,
  ownerUserId: string,
  input: CreateStaffForTurfInput,
) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  const staffUserId = await createStaffOwnerOrAdminAccount({
    role: 'TURF_STAFF',
    phone_number: input.phone_number,
    email: input.email,
    password: input.password,
  });

  const assignmentId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('turf_staff_assignments', [
    {
      assignment_id: assignmentId,
      turf_id: turfId,
      staff_user_id: staffUserId,
      permissions: JSON.stringify({}),
      assigned_by: ownerUserId,
      status: 'ACTIVE',
      verification_status: input.verified ? 'APPROVED' : 'PENDING',
      verification_document_url: null,
      verified_by: input.verified ? ownerUserId : null,
      verified_at: input.verified ? now : null,
      rejection_reason: null,
      created_at: now,
    },
  ]);

  await writeAuditLog({
    actorUserId: ownerUserId,
    actorRole: 'TURF_OWNER',
    action: 'STAFF_ACCOUNT_CREATED',
    resourceType: 'user',
    resourceId: staffUserId,
    afterData: {
      turf_id: turfId,
      phone_number: input.phone_number,
      verified: Boolean(input.verified),
    },
  });
  return fetchAssignment(assignmentId);
}

export async function listStaffForTurf(turfId: string, ownerUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  const rows = await sequelize.query<StaffAssignmentRow & { phone_number: string }>(
    `SELECT tsa.*, u.phone_number FROM turf_staff_assignments tsa
     JOIN users u ON u.user_id = tsa.staff_user_id
     WHERE tsa.turf_id = :turfId
     ORDER BY tsa.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { turfId } },
  );
  return Promise.all(
    rows.map(async (r) => ({
      ...((await presentAssignment(r)) as typeof r),
      permissions: normalizePermissions(r.permissions),
    })),
  );
}

export async function removeStaff(assignmentId: string, ownerUserId: string) {
  const assignment = await fetchAssignment(assignmentId);
  if (!assignment) throw new StaffAssignmentNotFoundError();
  const turf = await fetchTurfOrThrow(assignment.turf_id);
  await assertIsOwner(turf, ownerUserId);

  await sequelize
    .getQueryInterface()
    .bulkUpdate('turf_staff_assignments', { status: 'INACTIVE' }, { assignment_id: assignmentId });
}

// Staff Verification, step 1 (PRD §32.14): the staff member uploads their
// ID/document. Re-submitting resets a REJECTED assignment back to PENDING
// so the owner reviews it again, rather than staying permanently rejected.
export async function submitVerificationDocument(
  staffUserId: string,
  turfId: string,
  documentUrl: string,
) {
  const [assignment] = await sequelize.query<StaffAssignmentRow>(
    `SELECT * FROM turf_staff_assignments WHERE turf_id = :turfId AND staff_user_id = :staffUserId AND status = 'ACTIVE'`,
    { type: QueryTypes.SELECT, replacements: { turfId, staffUserId } },
  );
  if (!assignment) throw new StaffAssignmentNotFoundError();

  await sequelize.getQueryInterface().bulkUpdate(
    'turf_staff_assignments',
    {
      verification_document_url: documentUrl,
      verification_status: 'PENDING',
      verified_by: null,
      verified_at: null,
      rejection_reason: null,
    },
    { assignment_id: assignment.assignment_id },
  );
  return presentAssignment(await fetchAssignment(assignment.assignment_id));
}

// Staff Verification, step 2 (PRD §32.14): the owner reviews and decides.
export async function reviewVerification(
  assignmentId: string,
  ownerUserId: string,
  decision: 'APPROVED' | 'REJECTED',
  rejectionReason?: string | null,
) {
  const assignment = await fetchAssignment(assignmentId);
  if (!assignment) throw new StaffAssignmentNotFoundError();
  const turf = await fetchTurfOrThrow(assignment.turf_id);
  await assertIsOwner(turf, ownerUserId);

  await sequelize.getQueryInterface().bulkUpdate(
    'turf_staff_assignments',
    {
      verification_status: decision,
      verified_by: ownerUserId,
      verified_at: new Date(),
      rejection_reason: decision === 'REJECTED' ? (rejectionReason ?? null) : null,
    },
    { assignment_id: assignmentId },
  );

  await sendNotification({
    userId: assignment.staff_user_id,
    event: 'BOOKING_UPDATE',
    params: {
      message:
        decision === 'APPROVED'
          ? 'Your staff verification was approved — you can now check players in and collect payments.'
          : `Your staff verification was rejected.${rejectionReason ? ` ${rejectionReason}` : ''}`,
    },
    relatedEntityType: 'turf',
    relatedEntityId: assignment.turf_id,
  });

  return presentAssignment(await fetchAssignment(assignmentId));
}

// The enforcement PRD §32.14 actually requires: called at the top of any
// staff action gated on verification (Check-In, cash Payments). A PLAYER
// captain collecting cash, or a staff member with no assignment at all
// (shouldn't happen given the auth model, but not this function's job to
// diagnose), is simply not a TURF_STAFF actor and skips this check
// entirely at the call site — see paymentService.recordCashPayment and
// matchService.staffCheckIn.
// Staff Mobile/Web — Today's Bookings (PRD §8.4/§9.3): bookings at any turf
// this staff member is actively assigned to, for today.
export async function getTodaysBookingsForStaff(staffUserId: string) {
  const today = istToday();
  return sequelize.query(
    `SELECT b.*, t.turf_name FROM bookings b
     JOIN turfs t ON t.turf_id = b.turf_id
     JOIN turf_staff_assignments tsa ON tsa.turf_id = t.turf_id
     WHERE tsa.staff_user_id = :staffUserId AND tsa.status = 'ACTIVE' AND b.booking_date = :today
     ORDER BY b.start_time ASC`,
    { type: QueryTypes.SELECT, replacements: { staffUserId, today } },
  );
}

// Staff Mobile/Web — Match Operations (PRD §8.4/§9.3): matches at any turf
// this staff member is actively assigned to.
export async function listMatchesForStaff(staffUserId: string) {
  return sequelize.query(
    `SELECT DISTINCT m.*, t.turf_name FROM matches m
     JOIN bookings b ON b.booking_id = m.booking_id
     JOIN turfs t ON t.turf_id = b.turf_id
     JOIN turf_staff_assignments tsa ON tsa.turf_id = t.turf_id
     WHERE tsa.staff_user_id = :staffUserId AND tsa.status = 'ACTIVE'
     ORDER BY m.scheduled_start_time DESC`,
    { type: QueryTypes.SELECT, replacements: { staffUserId } },
  );
}

// Staff Mobile/Web — "my assignments" (needed so the staff member's own
// Verification screen knows which turf_id to submit a document for,
// without the client having to already know it).
export async function getMyAssignments(staffUserId: string) {
  const rows = await sequelize.query<StaffAssignmentRow & { turf_name: string }>(
    `SELECT tsa.*, t.turf_name FROM turf_staff_assignments tsa
     JOIN turfs t ON t.turf_id = tsa.turf_id
     WHERE tsa.staff_user_id = :staffUserId AND tsa.status = 'ACTIVE'
     ORDER BY tsa.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { staffUserId } },
  );
  return Promise.all(rows.map((r) => presentAssignment(r) as Promise<typeof r>));
}

export async function assertStaffVerified(
  staffUserId: string,
  permission?: StaffPermission,
): Promise<void> {
  const assignments = await sequelize.query<{
    verification_status: string;
    permissions?: unknown;
  }>(
    `SELECT verification_status, permissions FROM turf_staff_assignments
     WHERE staff_user_id = :staffUserId AND status = 'ACTIVE'`,
    { type: QueryTypes.SELECT, replacements: { staffUserId } },
  );
  const approved = assignments.filter((a) => a.verification_status === 'APPROVED');
  if (approved.length === 0) throw new StaffNotVerifiedError();
  // Allowed when at least one approved assignment still grants it.
  if (permission && !approved.some((a) => normalizePermissions(a.permissions)[permission])) {
    throw new StaffPermissionDeniedError(STAFF_PERMISSION_LABELS[permission]);
  }
}

// ---- Staff permissions (OW-10, PRD §22.2) --------------------------------------
//
// The owner decides, per staff member, which desk actions they may perform.
// Everything defaults to allowed — the permissions column was always empty —
// so nothing changes for existing staff until an owner switches something off.

export const STAFF_PERMISSIONS = ['check_in', 'collect_cash', 'score_matches'] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  check_in: 'check players in',
  collect_cash: 'collect cash',
  score_matches: 'score matches',
};

export function normalizePermissions(raw: unknown): Record<StaffPermission, boolean> {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = {};
    }
  }
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(STAFF_PERMISSIONS.map((key) => [key, obj[key] !== false])) as Record<
    StaffPermission,
    boolean
  >;
}

export async function updateStaffPermissions(
  assignmentId: string,
  ownerUserId: string,
  changes: Partial<Record<StaffPermission, boolean>>,
) {
  const assignment = await fetchAssignment(assignmentId);
  if (!assignment) throw new StaffAssignmentNotFoundError();
  const turf = await fetchTurfOrThrow(assignment.turf_id);
  await assertIsOwner(turf, ownerUserId);

  const before = normalizePermissions(assignment.permissions);
  const after = { ...before };
  for (const key of STAFF_PERMISSIONS) {
    if (typeof changes[key] === 'boolean') after[key] = changes[key] as boolean;
  }
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'turf_staff_assignments',
      { permissions: JSON.stringify(after) },
      { assignment_id: assignmentId },
    );
  await writeAuditLog({
    actorUserId: ownerUserId,
    actorRole: 'TURF_OWNER',
    action: 'STAFF_PERMISSIONS_CHANGED',
    resourceType: 'turf_staff_assignment',
    resourceId: assignmentId,
    beforeData: before,
    afterData: after,
  });
  return presentAssignment(await fetchAssignment(assignmentId));
}

// ---- Staff activity ------------------------------------------------------------

export type StaffActivityAction = 'STAFF_CHECK_IN' | 'STAFF_CASH_COLLECTED';

// Best-effort: recording that a staff member did something must never make the
// action itself fail, so every failure is swallowed.
export async function recordStaffActivity(
  staffUserId: string,
  action: StaffActivityAction,
  resourceId: string,
  turfId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await writeAuditLog({
      actorUserId: staffUserId,
      actorRole: 'TURF_STAFF',
      action,
      resourceType: 'staff_activity',
      resourceId,
      afterData: { turf_id: turfId, ...details },
    });
  } catch {
    /* activity logging is advisory */
  }
}

export async function getTurfIdForMatch(matchId: string): Promise<string | null> {
  try {
    const [row] = await sequelize.query<{ turf_id: string }>(
      `SELECT b.turf_id FROM matches m JOIN bookings b ON b.booking_id = m.booking_id
       WHERE m.match_id = :matchId`,
      { type: QueryTypes.SELECT, replacements: { matchId } },
    );
    return row?.turf_id ?? null;
  } catch {
    return null;
  }
}

export async function getTurfIdForObligations(obligationIds: string[]): Promise<string | null> {
  if (obligationIds.length === 0) return null;
  try {
    const [row] = await sequelize.query<{ turf_id: string }>(
      `SELECT b.turf_id FROM payment_obligations o JOIN bookings b ON b.booking_id = o.booking_id
       WHERE o.obligation_id IN (:ids) LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { ids: obligationIds } },
    );
    return row?.turf_id ?? null;
  } catch {
    return null;
  }
}

export interface StaffActivityEntry {
  log_id: string;
  action: string;
  resource_id: string;
  details: Record<string, unknown> | null;
  created_at: Date;
}

// What one staff member has done at this owner's turf (latest 50).
export async function getStaffActivity(
  assignmentId: string,
  ownerUserId: string,
): Promise<StaffActivityEntry[]> {
  const assignment = await fetchAssignment(assignmentId);
  if (!assignment) throw new StaffAssignmentNotFoundError();
  const turf = await fetchTurfOrThrow(assignment.turf_id);
  await assertIsOwner(turf, ownerUserId);

  const rows = await sequelize.query<{
    log_id: string;
    action: string;
    resource_id: string;
    after_data: unknown;
    created_at: Date;
  }>(
    `SELECT log_id, action, resource_id, after_data, created_at
     FROM audit_logs
     WHERE actor_user_id = :staffUserId AND resource_type = 'staff_activity'
       AND JSON_UNQUOTE(JSON_EXTRACT(after_data, '$.turf_id')) = :turfId
     ORDER BY created_at DESC LIMIT 50`,
    {
      type: QueryTypes.SELECT,
      replacements: { staffUserId: assignment.staff_user_id, turfId: assignment.turf_id },
    },
  );
  return rows.map((r) => {
    let details: Record<string, unknown> | null = null;
    try {
      const parsed = typeof r.after_data === 'string' ? JSON.parse(r.after_data) : r.after_data;
      details = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      details = null;
    }
    return {
      log_id: r.log_id,
      action: r.action,
      resource_id: r.resource_id,
      details,
      created_at: r.created_at,
    };
  });
}
