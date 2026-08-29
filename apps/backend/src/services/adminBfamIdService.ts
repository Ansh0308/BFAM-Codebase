// Admin-only BFAM ID reservation system (PRD §12.59, updated — premium/
// jersey-number IDs like BF7, BF18 can be locked by an admin so the normal
// sequential allocator (see bfamIdAllocator.ts) skips them, then manually
// assigned to a specific existing player later). This is a deliberate,
// admin-initiated exception to "immutable once assigned" for the player's
// previous auto-allocated ID — not something a player can trigger themselves.

import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

export class AdminBfamIdError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function lockBfamId(bfamId: string, lockedBy: string, notes?: string | null) {
  const [existingUser] = await sequelize.query<{ user_id: string }>(
    'SELECT user_id FROM users WHERE bfam_id = :bfamId LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { bfamId } },
  );
  if (existingUser) {
    throw new AdminBfamIdError('This BFAM ID is already assigned to a user', 409);
  }

  const [existingReservation] = await sequelize.query<{ reservation_id: string }>(
    "SELECT reservation_id FROM reserved_bfam_ids WHERE bfam_id = :bfamId AND status = 'LOCKED'",
    { type: QueryTypes.SELECT, replacements: { bfamId } },
  );
  if (existingReservation) {
    throw new AdminBfamIdError('This BFAM ID is already locked', 409);
  }

  const now = new Date();
  const reservationId = randomUUID();
  await sequelize.getQueryInterface().bulkInsert('reserved_bfam_ids', [
    {
      reservation_id: reservationId,
      bfam_id: bfamId,
      status: 'LOCKED',
      locked_by: lockedBy,
      locked_at: now,
      notes: notes ?? null,
      assigned_to_user_id: null,
      assigned_at: null,
      created_at: now,
      updated_at: now,
    },
  ]);

  return { reservationId, bfamId, status: 'LOCKED' as const };
}

export async function unlockBfamId(bfamId: string) {
  const [reservation] = await sequelize.query<{ reservation_id: string; status: string }>(
    'SELECT reservation_id, status FROM reserved_bfam_ids WHERE bfam_id = :bfamId LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { bfamId } },
  );
  if (!reservation) {
    throw new AdminBfamIdError('No reservation found for this BFAM ID', 404);
  }
  if (reservation.status === 'ASSIGNED') {
    throw new AdminBfamIdError(
      'This BFAM ID has already been assigned and cannot be unlocked',
      409,
    );
  }

  await sequelize.query('DELETE FROM reserved_bfam_ids WHERE reservation_id = :id', {
    type: QueryTypes.DELETE,
    replacements: { id: reservation.reservation_id },
  });
}

export async function assignBfamId(bfamId: string, targetUserId: string) {
  const [reservation] = await sequelize.query<{ reservation_id: string; status: string }>(
    'SELECT reservation_id, status FROM reserved_bfam_ids WHERE bfam_id = :bfamId LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { bfamId } },
  );
  if (!reservation) {
    throw new AdminBfamIdError('This BFAM ID must be locked before it can be assigned', 404);
  }
  if (reservation.status === 'ASSIGNED') {
    throw new AdminBfamIdError('This BFAM ID has already been assigned', 409);
  }

  const [targetUser] = await sequelize.query<{ user_id: string; role: string }>(
    'SELECT user_id, role FROM users WHERE user_id = :id AND deleted_at IS NULL LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { id: targetUserId } },
  );
  if (!targetUser) {
    throw new AdminBfamIdError('Target user not found', 404);
  }
  if (targetUser.role !== 'PLAYER') {
    throw new AdminBfamIdError('BFAM IDs can only be assigned to PLAYER accounts', 400);
  }

  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    // players.bfam_id has an ON UPDATE CASCADE FK to users.bfam_id (see the
    // phase1 migration), so updating the user's row alone is enough — MySQL
    // propagates the change to their players row automatically.
    await sequelize.query(
      'UPDATE users SET bfam_id = :bfamId, updated_at = :now WHERE user_id = :id',
      { type: QueryTypes.UPDATE, replacements: { bfamId, now, id: targetUserId }, transaction },
    );
    await sequelize.query(
      "UPDATE reserved_bfam_ids SET status = 'ASSIGNED', assigned_to_user_id = :userId, assigned_at = :now, updated_at = :now WHERE reservation_id = :id",
      {
        type: QueryTypes.UPDATE,
        replacements: { userId: targetUserId, now, id: reservation.reservation_id },
        transaction,
      },
    );
  });
}

export interface ReservedBfamIdRow {
  reservation_id: string;
  bfam_id: string;
  status: 'LOCKED' | 'ASSIGNED';
  locked_by: string;
  locked_at: Date;
  notes: string | null;
  assigned_to_user_id: string | null;
  assigned_at: Date | null;
}

export async function listReservedBfamIds(): Promise<ReservedBfamIdRow[]> {
  return sequelize.query<ReservedBfamIdRow>(
    'SELECT reservation_id, bfam_id, status, locked_by, locked_at, notes, assigned_to_user_id, assigned_at FROM reserved_bfam_ids ORDER BY locked_at DESC',
    { type: QueryTypes.SELECT },
  );
}
