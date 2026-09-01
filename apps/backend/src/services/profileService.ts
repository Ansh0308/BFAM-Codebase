// Backs GET/PATCH /profile/me (Module 2.2 — Player Profile). Reads/writes
// span both `users` (identity fields every role has) and `players`
// (cricket-specific fields, PLAYER role only) in one call so the mobile
// Profile Setup screen doesn't need two round trips.

import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { UserRole } from './authService';

export interface MyProfile {
  user_id: string;
  bfam_id: string | null;
  role: UserRole;
  phone_number: string;
  email: string | null;
  // Set only once the email has been proven via OTP — see
  // POST /profile/email/verify-otp. NULL for an unverified/no email.
  email_verified_at: string | null;
  profile_photo_url: string | null;
  city: string | null;
  preferred_language: string | null;
  // Player-only fields — null for TURF_OWNER/TURF_STAFF/ADMIN.
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  experience_level: string | null;
  date_of_birth: string | null;
  gender: string | null;
  skill_rating: number | null;
  reliability_score: string | null;
  favorite_cricketer_name: string | null;
  favorite_cricketer_external_id: string | null;
}

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const [user] = await sequelize.query<{
    user_id: string;
    bfam_id: string | null;
    role: UserRole;
    phone_number: string;
    email: string | null;
    email_verified_at: string | null;
    profile_photo_url: string | null;
    city: string | null;
    preferred_language: string | null;
  }>(
    'SELECT user_id, bfam_id, role, phone_number, email, email_verified_at, profile_photo_url, city, preferred_language FROM users WHERE user_id = :userId AND deleted_at IS NULL LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!user) return null;

  if (user.role !== 'PLAYER') {
    return {
      ...user,
      playing_role: null,
      batting_style: null,
      bowling_style: null,
      experience_level: null,
      date_of_birth: null,
      gender: null,
      skill_rating: null,
      reliability_score: null,
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
    };
  }

  const [player] = await sequelize.query<{
    playing_role: string | null;
    batting_style: string | null;
    bowling_style: string | null;
    experience_level: string | null;
    date_of_birth: string | null;
    gender: string | null;
    skill_rating: number | null;
    reliability_score: string | null;
    favorite_cricketer_name: string | null;
    favorite_cricketer_external_id: string | null;
  }>(
    'SELECT playing_role, batting_style, bowling_style, experience_level, date_of_birth, gender, skill_rating, reliability_score, favorite_cricketer_name, favorite_cricketer_external_id FROM players WHERE user_id = :userId LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );

  return {
    ...user,
    ...(player ?? {
      playing_role: null,
      batting_style: null,
      bowling_style: null,
      experience_level: null,
      date_of_birth: null,
      gender: null,
      skill_rating: null,
      reliability_score: null,
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
    }),
  };
}

// Note: `email` is deliberately NOT part of this generic update — it can
// only be set via the verified-email flow (POST /profile/email/send-otp +
// verify-otp, see setVerifiedEmail below), so an unverified email can never
// end up on a profile.
export interface UpdateProfileInput {
  profile_photo_url?: string | null;
  city?: string | null;
  preferred_language?: string | null;
  playing_role?: string | null;
  batting_style?: string | null;
  bowling_style?: string | null;
  experience_level?: string;
  date_of_birth?: string | null;
  gender?: string | null;
}

// Thrown when the requested email is already registered to another account
// (users.email has a unique constraint) — app.ts maps this to a 409 instead
// of a generic 500.
export class DuplicateEmailError extends Error {
  constructor() {
    super('This email is already registered to another account');
    this.name = 'DuplicateEmailError';
  }
}

export async function updateMyProfile(
  userId: string,
  role: UserRole,
  input: UpdateProfileInput,
): Promise<void> {
  const now = new Date();
  const userFields: Record<string, unknown> = {};
  if ('profile_photo_url' in input) userFields.profile_photo_url = input.profile_photo_url;
  if ('city' in input) userFields.city = input.city;
  if ('preferred_language' in input) userFields.preferred_language = input.preferred_language;

  await sequelize.transaction(async (transaction) => {
    if (Object.keys(userFields).length > 0) {
      const setClauses = Object.keys(userFields)
        .map((key) => `${key} = :${key}`)
        .join(', ');
      await sequelize.query(
        `UPDATE users SET ${setClauses}, updated_at = :now WHERE user_id = :userId`,
        { type: QueryTypes.UPDATE, replacements: { ...userFields, now, userId }, transaction },
      );
    }

    // Player-only fields are silently ignored for non-PLAYER accounts —
    // there is no `players` row to update.
    if (role !== 'PLAYER') return;

    const playerFields: Record<string, unknown> = {};
    if ('playing_role' in input) playerFields.playing_role = input.playing_role;
    if ('batting_style' in input) playerFields.batting_style = input.batting_style;
    if ('bowling_style' in input) playerFields.bowling_style = input.bowling_style;
    if ('experience_level' in input) playerFields.experience_level = input.experience_level;
    if ('date_of_birth' in input) playerFields.date_of_birth = input.date_of_birth;
    if ('gender' in input) playerFields.gender = input.gender;

    if (Object.keys(playerFields).length > 0) {
      const setClauses = Object.keys(playerFields)
        .map((key) => `${key} = :${key}`)
        .join(', ');
      await sequelize.query(
        `UPDATE players SET ${setClauses}, updated_at = :now WHERE user_id = :userId`,
        { type: QueryTypes.UPDATE, replacements: { ...playerFields, now, userId }, transaction },
      );
    }
  });
}

/**
 * Persists an email as verified — only ever called after
 * verifyAndConsumeOtp(email, 'EMAIL_VERIFY', otp) returns VALID (see
 * POST /profile/email/verify-otp in app.ts). Sets both `email` and
 * `email_verified_at` together so an email can never appear on a profile
 * without having actually been proven.
 */
export async function setVerifiedEmail(userId: string, email: string): Promise<void> {
  const now = new Date();
  try {
    await sequelize.query(
      'UPDATE users SET email = :email, email_verified_at = :now, updated_at = :now WHERE user_id = :userId',
      { type: QueryTypes.UPDATE, replacements: { email, now, userId } },
    );
  } catch (error) {
    const code = (error as { original?: { code?: string } })?.original?.code;
    if (code === 'ER_DUP_ENTRY') {
      throw new DuplicateEmailError();
    }
    throw error;
  }
}
