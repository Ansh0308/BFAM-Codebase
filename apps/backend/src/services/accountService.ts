// Shared "create a BFAM user account" logic used by both POST /auth/register
// (phone/password signup) and POST /auth/social/complete (Google/Apple
// signup after phone-number collection) — extracted so both routes reuse the
// exact same allocateBfamId locking discipline and the same optional
// `players` row insert, instead of duplicating it.
//
// BFAM IDs are issued to PLAYER accounts only (PRD §12.59, updated) —
// TURF_OWNER/TURF_STAFF accounts get `bfam_id: null` and no `players` row,
// and never touch the allocator (no shared counter, nothing to lock).

import { randomUUID } from 'crypto';
import { Transaction } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { allocateBfamId } from './bfamIdAllocator';
import { lookupJerseyNumber } from './cricketerSearchService';
import { UserRole } from './authService';

export interface CreateAccountInput {
  phoneNumber: string;
  email?: string | null;
  passwordHash: string;
  role: UserRole;
  city?: string | null;
  preferredLanguage?: string | null;
  googleId?: string | null;
  appleId?: string | null;
  /** Set when the identifier verified via OTP was the phone number. */
  phoneVerified?: boolean;
  favoriteCricketerName?: string | null;
  favoriteCricketerExternalId?: string | null;
}

export interface CreatedAccount {
  userId: string;
  bfamId: string | null;
}

export async function createUserAccount(input: CreateAccountInput): Promise<CreatedAccount> {
  const userId = randomUUID();
  const now = new Date();

  const baseUserRow = {
    user_id: userId,
    phone_number: input.phoneNumber,
    email: input.email ?? null,
    password_hash: input.passwordHash,
    role: input.role,
    account_status: 'ACTIVE',
    phone_verified_at: input.phoneVerified ? now : null,
    profile_photo_url: null,
    city: input.city ?? null,
    preferred_language: input.preferredLanguage ?? 'en',
    google_id: input.googleId ?? null,
    apple_id: input.appleId ?? null,
    is_minor: false,
    last_login_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  if (input.role !== 'PLAYER') {
    await sequelize.getQueryInterface().bulkInsert('users', [{ ...baseUserRow, bfam_id: null }]);
    return { userId, bfamId: null };
  }

  // Try to land a BFAM ID ending in the player's favorite cricketer's
  // jersey number first (product request, 2026-08-30) — see
  // bfamIdAllocator.ts for the full algorithm and its fallback behavior.
  const jerseyNumberSuffix = await lookupJerseyNumber(input.favoriteCricketerExternalId);

  const { bfamId } = await allocateBfamId(async (bfamId, transaction: Transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkInsert('users', [{ ...baseUserRow, bfam_id: bfamId }], { transaction });

    await sequelize.getQueryInterface().bulkInsert(
      'players',
      [
        {
          player_id: randomUUID(),
          user_id: userId,
          bfam_id: bfamId,
          playing_role: null,
          batting_style: null,
          bowling_style: null,
          experience_level: 'BEGINNER',
          skill_rating: 500,
          reliability_score: 100,
          bio: null,
          date_of_birth: null,
          favorite_cricketer_name: input.favoriteCricketerName ?? null,
          favorite_cricketer_external_id: input.favoriteCricketerExternalId ?? null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ],
      { transaction },
    );

    return userId;
  }, jerseyNumberSuffix);

  return { userId, bfamId };
}
