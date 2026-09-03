import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  ForbiddenActionError,
  StaffAssignmentNotFoundError,
  StaffNotVerifiedError,
  TurfNotFoundError,
} from '../domain/errors';
import { sendNotification } from './notificationService';

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

export async function listStaffForTurf(turfId: string, ownerUserId: string) {
  const turf = await fetchTurfOrThrow(turfId);
  await assertIsOwner(turf, ownerUserId);

  return sequelize.query<StaffAssignmentRow & { phone_number: string }>(
    `SELECT tsa.*, u.phone_number FROM turf_staff_assignments tsa
     JOIN users u ON u.user_id = tsa.staff_user_id
     WHERE tsa.turf_id = :turfId
     ORDER BY tsa.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { turfId } },
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
  return fetchAssignment(assignment.assignment_id);
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

  return fetchAssignment(assignmentId);
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
  const today = new Date().toISOString().slice(0, 10);
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
  return sequelize.query<StaffAssignmentRow & { turf_name: string }>(
    `SELECT tsa.*, t.turf_name FROM turf_staff_assignments tsa
     JOIN turfs t ON t.turf_id = tsa.turf_id
     WHERE tsa.staff_user_id = :staffUserId AND tsa.status = 'ACTIVE'
     ORDER BY tsa.created_at DESC`,
    { type: QueryTypes.SELECT, replacements: { staffUserId } },
  );
}

export async function assertStaffVerified(staffUserId: string): Promise<void> {
  const assignments = await sequelize.query<{ verification_status: string }>(
    `SELECT verification_status FROM turf_staff_assignments
     WHERE staff_user_id = :staffUserId AND status = 'ACTIVE'`,
    { type: QueryTypes.SELECT, replacements: { staffUserId } },
  );
  const approved = assignments.some((a) => a.verification_status === 'APPROVED');
  if (!approved) throw new StaffNotVerifiedError();
}
