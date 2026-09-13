// Backs GET/PATCH /profile/me (Module 2.2 — Player Profile). Reads/writes
// span both `users` (identity fields every role has) and `players`
// (cricket-specific fields, PLAYER role only) in one call so the mobile
// Profile Setup screen doesn't need two round trips.

import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { UserRole } from './authService';
import { PlayerNotFoundError, UnderMinimumAgeError } from '../domain/errors';
import { getFollowSummary, type FollowSummary } from './followService';

// Backlog G-04 (PRD §32.7): a minimum age enforced when date_of_birth is
// set — below it, the update is rejected outright rather than silently
// accepted; 13-17 is allowed but flagged via users.is_minor for whatever UI
// gating a parent/guardian-consent step ends up needing (out of scope
// here — this only computes and stores the flag).
export const MINIMUM_AGE_YEARS = 13;
const MINOR_UNTIL_AGE_YEARS = 18;

// Pure so it's trivially testable without faking the system clock inside a
// bigger update flow — `today` defaults to now but can be overridden.
export function calculateAge(dateOfBirth: string, today: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

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
  // Backlog G-04 — true once a stored date_of_birth implies age 13-17;
  // false for an adult or an account with no date of birth on file yet.
  is_minor: boolean;
  // Player-only fields — null for TURF_OWNER/TURF_STAFF/ADMIN.
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  experience_level: string | null;
  date_of_birth: string | null;
  gender: string | null;
  skill_rating: number | null;
  reliability_score: string | null;
  // Backlog G-01 — participation fairness, split out from reliability_score.
  fair_play_rating: string | null;
  // Backlog G-03 — peer-rated "how was this player to play with" average;
  // null until at least one teammate has rated them.
  community_rating: string | null;
  favorite_cricketer_name: string | null;
  favorite_cricketer_external_id: string | null;
  // Backlog A-9 — shown in place of the BFAM ID everywhere a player is
  // listed; null for a player who hasn't set one yet, and always null for
  // non-PLAYER roles (no `players` row to hold it).
  full_name: string | null;
  // Backlog B-1/B-4 — BFAM Coins balance; null for non-PLAYER roles (no
  // `players` row to hold it), never null for an actual player (defaults
  // to 0).
  coin_balance: number | null;
  // Backlog B-9 follow-up: the same follower/following counts shown when
  // viewing another player's profile, now also shown on your own; null for
  // non-PLAYER roles.
  follow_summary: FollowSummary | null;
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
    is_minor: boolean;
  }>(
    'SELECT user_id, bfam_id, role, phone_number, email, email_verified_at, profile_photo_url, city, preferred_language, is_minor FROM users WHERE user_id = :userId AND deleted_at IS NULL LIMIT 1',
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
      fair_play_rating: null,
      community_rating: null,
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
      full_name: null,
      coin_balance: null,
      follow_summary: null,
    };
  }

  const [player] = await sequelize.query<{
    player_id: string;
    playing_role: string | null;
    batting_style: string | null;
    bowling_style: string | null;
    experience_level: string | null;
    date_of_birth: string | null;
    gender: string | null;
    skill_rating: number | null;
    reliability_score: string | null;
    fair_play_rating: string | null;
    community_rating: string | null;
    favorite_cricketer_name: string | null;
    favorite_cricketer_external_id: string | null;
    full_name: string | null;
    coin_balance: number | null;
  }>(
    'SELECT player_id, playing_role, batting_style, bowling_style, experience_level, date_of_birth, gender, skill_rating, reliability_score, fair_play_rating, community_rating, favorite_cricketer_name, favorite_cricketer_external_id, full_name, coin_balance FROM players WHERE user_id = :userId LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );

  // Backlog B-9 follow-up: a player's own profile shows the same
  // followers/following counts already shown when viewing someone else's
  // (getPublicProfile) — no "am I following myself" question here, so
  // `is_following` is always false and simply unused by the mobile screen.
  const follow_summary = player ? await getFollowSummary(player.player_id) : null;

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
      fair_play_rating: null,
      community_rating: null,
      favorite_cricketer_name: null,
      favorite_cricketer_external_id: null,
      full_name: null,
      coin_balance: null,
    }),
    follow_summary,
  };
}

// Backlog B-10: another player's profile, viewed from a roster/team row —
// deliberately a much smaller shape than MyProfile. Excludes everything
// privacy-sensitive (phone_number, email, date_of_birth, gender,
// coin_balance) and everything only meaningful to the account owner.
// skill_rating/reliability_score ARE included — both are already shown in
// team/match-facing contexts elsewhere in the app (Open Teams' Fair Play
// score, the scorecard), so there's no new exposure in showing them on a
// profile a teammate taps into from a roster row.
export interface PublicPlayerProfile {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  city: string | null;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  experience_level: string | null;
  skill_rating: number;
  reliability_score: string;
  fair_play_rating: string;
  community_rating: string | null;
  favorite_cricketer_name: string | null;
  // Backlog B-9 — follower/following counts, plus whether the viewer
  // (if any) currently follows this player.
  follow_summary: FollowSummary;
}

export async function getPublicProfile(
  playerId: string,
  viewerUserId?: string,
): Promise<PublicPlayerProfile> {
  const [row] = await sequelize.query<Omit<PublicPlayerProfile, 'follow_summary'>>(
    `SELECT p.player_id, p.bfam_id, p.full_name, u.profile_photo_url, u.city,
            p.playing_role, p.batting_style, p.bowling_style, p.experience_level,
            p.skill_rating, p.reliability_score, p.fair_play_rating, p.community_rating,
            p.favorite_cricketer_name
     FROM players p
     JOIN users u ON u.user_id = p.user_id
     WHERE p.player_id = :playerId AND u.deleted_at IS NULL`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
  if (!row) throw new PlayerNotFoundError(playerId);
  const follow_summary = await getFollowSummary(playerId, viewerUserId);
  return { ...row, follow_summary };
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
  full_name?: string | null;
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

  // Backlog G-04: date_of_birth lives on `players`, but is_minor lives on
  // `users` — computed here so both land in the same transaction below.
  if ('date_of_birth' in input) {
    if (input.date_of_birth) {
      const age = calculateAge(input.date_of_birth);
      if (age < MINIMUM_AGE_YEARS) throw new UnderMinimumAgeError(MINIMUM_AGE_YEARS);
      userFields.is_minor = age < MINOR_UNTIL_AGE_YEARS;
    } else {
      userFields.is_minor = false;
    }
  }

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
    if ('full_name' in input) playerFields.full_name = input.full_name;

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
