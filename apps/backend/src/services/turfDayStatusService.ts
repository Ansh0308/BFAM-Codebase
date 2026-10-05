import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { bookingStartInstant, istToday } from '../domain/time';
import { writeAuditLog } from './auditLogService';
import { assertStaffVerified } from './staffService';
import { StaffNotVerifiedError } from '../domain/errors';

// Turf open / closed for the day (SW-5, PRD §22.2). "Closed" is an
// availability block over today (reason DAY_CLOSED), so the booking check that
// already honours blocks refuses new bookings with no further change. Existing
// bookings are not touched: the response says how many there are so the
// person closing the turf can contact those customers.

export class TurfDayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TurfDayError';
  }
}

export interface TurfDayStatus {
  turf_id: string;
  turf_name: string;
  city: string;
  closed: boolean;
  /** Upcoming PENDING / CONFIRMED bookings today (so closing is not a surprise). */
  bookings_today: number;
}

export interface DayActor {
  userId: string;
  role: 'TURF_OWNER' | 'TURF_STAFF';
}

async function statusFor(turfIds: string[]): Promise<TurfDayStatus[]> {
  if (turfIds.length === 0) return [];
  const today = istToday();
  const now = new Date();
  const turfs = await sequelize.query<{ turf_id: string; turf_name: string; city: string }>(
    `SELECT turf_id, turf_name, city FROM turfs
     WHERE turf_id IN (:turfIds) AND deleted_at IS NULL ORDER BY turf_name`,
    { type: QueryTypes.SELECT, replacements: { turfIds } },
  );
  const closed = await sequelize.query<{ turf_id: string }>(
    `SELECT DISTINCT turf_id FROM turf_availability_blocks
     WHERE turf_id IN (:turfIds) AND reason = 'DAY_CLOSED'
       AND start_datetime <= :now AND end_datetime > :now`,
    { type: QueryTypes.SELECT, replacements: { turfIds, now } },
  );
  const booked = await sequelize.query<{ turf_id: string; n: number | string }>(
    `SELECT turf_id, COUNT(*) AS n FROM bookings
     WHERE turf_id IN (:turfIds) AND booking_date = :today
       AND booking_status IN ('PENDING', 'CONFIRMED') GROUP BY turf_id`,
    { type: QueryTypes.SELECT, replacements: { turfIds, today } },
  );
  const closedSet = new Set(closed.map((c) => c.turf_id));
  const bookedMap = new Map(booked.map((b) => [b.turf_id, Number(b.n)]));
  return turfs.map((t) => ({
    ...t,
    closed: closedSet.has(t.turf_id),
    bookings_today: bookedMap.get(t.turf_id) ?? 0,
  }));
}

export async function listTurfDayStatus(actor: DayActor): Promise<TurfDayStatus[]> {
  const rows =
    actor.role === 'TURF_OWNER'
      ? await sequelize.query<{ turf_id: string }>(
          "SELECT turf_id FROM turfs WHERE owner_id = :userId AND deleted_at IS NULL AND turf_status = 'ACTIVE'",
          { type: QueryTypes.SELECT, replacements: { userId: actor.userId } },
        )
      : await sequelize.query<{ turf_id: string }>(
          `SELECT a.turf_id FROM turf_staff_assignments a JOIN turfs t ON t.turf_id = a.turf_id
           WHERE a.staff_user_id = :userId AND a.status = 'ACTIVE' AND t.deleted_at IS NULL
             AND t.turf_status = 'ACTIVE'`,
          { type: QueryTypes.SELECT, replacements: { userId: actor.userId } },
        );
  return statusFor(rows.map((r) => r.turf_id));
}

async function assertMayChange(actor: DayActor, turfId: string) {
  if (actor.role === 'TURF_OWNER') {
    const [turf] = await sequelize.query<{ turf_id: string }>(
      'SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :userId AND deleted_at IS NULL',
      { type: QueryTypes.SELECT, replacements: { turfId, userId: actor.userId } },
    );
    if (!turf) throw new TurfDayError('Turf not found.', 404);
    return;
  }
  const [assignment] = await sequelize.query<{ assignment_id: string }>(
    `SELECT assignment_id FROM turf_staff_assignments
     WHERE turf_id = :turfId AND staff_user_id = :userId AND status = 'ACTIVE'`,
    { type: QueryTypes.SELECT, replacements: { turfId, userId: actor.userId } },
  );
  if (!assignment) throw new TurfDayError('You are not assigned to this turf.', 403);
  try {
    await assertStaffVerified(actor.userId, 'close_turf');
  } catch (error) {
    if (error instanceof StaffNotVerifiedError) throw new TurfDayError(error.message, 403);
    throw error;
  }
}

export async function setTurfClosedToday(
  actor: DayActor,
  turfId: string,
  closed: boolean,
): Promise<TurfDayStatus> {
  await assertMayChange(actor, turfId);
  const [current] = await statusFor([turfId]);
  if (!current) throw new TurfDayError('Turf not found.', 404);

  const now = new Date();
  if (closed && !current.closed) {
    const start = bookingStartInstant(istToday(now), '00:00');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    await sequelize.getQueryInterface().bulkInsert('turf_availability_blocks', [
      {
        block_id: randomUUID(),
        turf_id: turfId,
        start_datetime: start,
        end_datetime: end,
        reason: 'DAY_CLOSED',
        created_by: actor.userId,
        created_at: now,
      },
    ]);
  } else if (!closed && current.closed) {
    const blocks = await sequelize.query<{ block_id: string }>(
      `SELECT block_id FROM turf_availability_blocks
       WHERE turf_id = :turfId AND reason = 'DAY_CLOSED'
         AND start_datetime <= :now AND end_datetime > :now`,
      { type: QueryTypes.SELECT, replacements: { turfId, now } },
    );
    for (const b of blocks) {
      await sequelize
        .getQueryInterface()
        .bulkDelete('turf_availability_blocks', { block_id: b.block_id });
    }
  } else {
    return current;
  }

  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: closed ? 'TURF_CLOSED_TODAY' : 'TURF_REOPENED_TODAY',
    resourceType: 'turf',
    resourceId: turfId,
    afterData: { turf_id: turfId, bookings_today: current.bookings_today },
  });
  return { ...current, closed };
}
