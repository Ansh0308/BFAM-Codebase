import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { writeAuditLog } from './auditLogService';

// Admin Web — Users (PRD §9.1 "user management (players, owners, staff)").
// The only place Turf Owner / Turf Staff / Admin accounts are created (the
// public sign-up is player-only), plus edit, suspend, password reset and
// delete for every account type.

export class AdminUserError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AdminUserError';
  }
}

export interface AdminUserRow {
  user_id: string;
  role: 'PLAYER' | 'TURF_OWNER' | 'TURF_STAFF' | 'ADMIN';
  phone_number: string;
  email: string | null;
  city: string | null;
  account_status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  bfam_id: string | null;
  full_name: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

const USER_SELECT = `SELECT u.user_id, u.role, u.phone_number, u.email, u.city, u.account_status,
       u.bfam_id, p.full_name, u.created_at, u.last_login_at
     FROM users u
     LEFT JOIN players p ON p.user_id = u.user_id`;

export async function listUsers(filters: { role?: string; status?: string }) {
  const where = ['u.deleted_at IS NULL'];
  const replacements: Record<string, unknown> = {};
  if (filters.role) {
    where.push('u.role = :role');
    replacements.role = filters.role;
  }
  if (filters.status) {
    where.push('u.account_status = :status');
    replacements.status = filters.status;
  }
  return sequelize.query<AdminUserRow>(
    `${USER_SELECT} WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT 1000`,
    { type: QueryTypes.SELECT, replacements },
  );
}

async function fetchUser(userId: string): Promise<AdminUserRow | null> {
  const [row] = await sequelize.query<AdminUserRow>(
    `${USER_SELECT} WHERE u.user_id = :userId AND u.deleted_at IS NULL`,
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  return row ?? null;
}

async function assertContactFree(
  phone: string | undefined,
  email: string | null | undefined,
  exceptUserId?: string,
) {
  if (phone) {
    const rows = await sequelize.query<{ user_id: string }>(
      'SELECT user_id FROM users WHERE phone_number = :phone AND deleted_at IS NULL AND user_id <> :except',
      { type: QueryTypes.SELECT, replacements: { phone, except: exceptUserId ?? '' } },
    );
    if (rows.length) throw new AdminUserError('That phone number is already in use.', 409);
  }
  if (email) {
    const rows = await sequelize.query<{ user_id: string }>(
      'SELECT user_id FROM users WHERE email = :email AND deleted_at IS NULL AND user_id <> :except',
      { type: QueryTypes.SELECT, replacements: { email, except: exceptUserId ?? '' } },
    );
    if (rows.length) throw new AdminUserError('That email is already in use.', 409);
  }
}

export interface CreateStaffOwnerAdminInput {
  role: 'TURF_OWNER' | 'TURF_STAFF' | 'ADMIN';
  phone_number: string;
  email?: string | null;
  password: string;
  city?: string | null;
}

// Creates an account with no BFAM ID (only players carry one, PRD §12.59).
// Shared with the owner's "create staff" action.
export async function createStaffOwnerOrAdminAccount(
  input: CreateStaffOwnerAdminInput,
): Promise<string> {
  await assertContactFree(input.phone_number, input.email);
  const userId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('users', [
    {
      user_id: userId,
      phone_number: input.phone_number,
      email: input.email ?? null,
      password_hash: await bcrypt.hash(input.password, 10),
      role: input.role,
      account_status: 'ACTIVE',
      phone_verified_at: now,
      profile_photo_url: null,
      city: input.city ?? null,
      preferred_language: 'en',
      bfam_id: null,
      google_id: null,
      apple_id: null,
      is_minor: false,
      last_login_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ]);
  return userId;
}

export async function adminCreateUser(actorUserId: string, input: CreateStaffOwnerAdminInput) {
  const userId = await createStaffOwnerOrAdminAccount(input);
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'USER_CREATED',
    resourceType: 'user',
    resourceId: userId,
    afterData: { role: input.role, phone_number: input.phone_number, email: input.email ?? null },
  });
  return (await fetchUser(userId)) as AdminUserRow;
}

export interface UpdateUserInput {
  phone_number?: string;
  email?: string | null;
  city?: string | null;
  account_status?: 'ACTIVE' | 'SUSPENDED';
  full_name?: string | null;
}

export async function adminUpdateUser(actorUserId: string, userId: string, input: UpdateUserInput) {
  const existing = await fetchUser(userId);
  if (!existing) throw new AdminUserError('User not found.', 404);
  if (userId === actorUserId && input.account_status === 'SUSPENDED') {
    throw new AdminUserError('You cannot suspend your own account.', 400);
  }
  await assertContactFree(
    input.phone_number && input.phone_number !== existing.phone_number
      ? input.phone_number
      : undefined,
    input.email && input.email !== existing.email ? input.email : undefined,
    userId,
  );

  const userChanges: Record<string, unknown> = {};
  for (const key of ['phone_number', 'email', 'city', 'account_status'] as const) {
    if (input[key] !== undefined) userChanges[key] = input[key];
  }
  if (Object.keys(userChanges).length > 0) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate('users', { ...userChanges, updated_at: new Date() }, { user_id: userId });
  }
  // Only players have a profile row (and so a name).
  if (input.full_name !== undefined && existing.role === 'PLAYER') {
    await sequelize
      .getQueryInterface()
      .bulkUpdate('players', { full_name: input.full_name }, { user_id: userId });
  }

  const updated = (await fetchUser(userId)) as AdminUserRow;
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'USER_UPDATED',
    resourceType: 'user',
    resourceId: userId,
    beforeData: {
      phone_number: existing.phone_number,
      email: existing.email,
      city: existing.city,
      account_status: existing.account_status,
      full_name: existing.full_name,
    },
    afterData: {
      phone_number: updated.phone_number,
      email: updated.email,
      city: updated.city,
      account_status: updated.account_status,
      full_name: updated.full_name,
    },
  });
  return updated;
}

export async function adminResetPassword(actorUserId: string, userId: string, newPassword: string) {
  const existing = await fetchUser(userId);
  if (!existing) throw new AdminUserError('User not found.', 404);
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'users',
      { password_hash: await bcrypt.hash(newPassword, 10), updated_at: new Date() },
      { user_id: userId },
    );
  // The password itself is never logged.
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'USER_PASSWORD_RESET',
    resourceType: 'user',
    resourceId: userId,
  });
}

// Soft delete: the account stops working and drops out of every list, but the
// rows that reference it (bookings, matches, payments) stay intact. An owner
// who still has live turfs can't be deleted until those are dealt with.
export async function adminDeleteUser(actorUserId: string, userId: string) {
  if (userId === actorUserId) throw new AdminUserError('You cannot delete your own account.', 400);
  const existing = await fetchUser(userId);
  if (!existing) throw new AdminUserError('User not found.', 404);

  if (existing.role === 'TURF_OWNER') {
    const [row] = await sequelize.query<{ n: number | string }>(
      'SELECT COUNT(*) AS n FROM turfs WHERE owner_id = :userId AND deleted_at IS NULL',
      { type: QueryTypes.SELECT, replacements: { userId } },
    );
    if (Number(row?.n ?? 0) > 0) {
      throw new AdminUserError(
        'This owner still has turfs. Delete or reassign their turfs first.',
        409,
      );
    }
  }

  const now = new Date();
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'users',
      { deleted_at: now, account_status: 'DELETED', updated_at: now },
      { user_id: userId },
    );
  await writeAuditLog({
    actorUserId,
    actorRole: 'ADMIN',
    action: 'USER_DELETED',
    resourceType: 'user',
    resourceId: userId,
    beforeData: { role: existing.role, phone_number: existing.phone_number },
  });
}
