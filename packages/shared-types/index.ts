// Fixed to match apps/backend/src/domain/constants.ts USER_ROLES exactly.
// Was previously 'PLAYER' | 'OWNER' | 'STAFF' | 'ADMIN' — stale/wrong values
// that never matched the DB's `role` ENUM or the backend's zod schemas.
export type UserRole = 'PLAYER' | 'TURF_OWNER' | 'TURF_STAFF' | 'ADMIN';

// Roles a user may self-select during signup/social-signup (excludes ADMIN,
// which is never a self-service signup role).
export type SelfServiceUserRole = Exclude<UserRole, 'ADMIN'>;

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export type OtpPurpose = 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD';

export type SocialProvider = 'google' | 'apple';

// Response shape for POST /auth/google and /auth/apple when the verified
// social identity does not yet map to an existing BFAM user — the client
// must collect a phone number + role and call /auth/social/complete with
// this ticket before an account is created.
export interface SocialTicketResponse {
  social_ticket: string;
  email?: string | null;
  name?: string | null;
}

// Common shape for a successful login (password, OTP, or existing-user
// social auth) — always issued via the same issueJwt() call server-side so
// downstream role/permission logic never branches by login method.
export interface AuthSuccessResponse {
  token: string;
  user_id: string;
  // Only set for PLAYER accounts (PRD §12.59, updated) — null for
  // TURF_OWNER/TURF_STAFF/ADMIN.
  bfam_id: string | null;
  role: UserRole;
}

// GET/PATCH /profile/me (Module 2.2 — Player Profile / Profile Setup).
// Player-only fields are null for TURF_OWNER/TURF_STAFF/ADMIN accounts.
export interface MyProfile {
  user_id: string;
  bfam_id: string | null;
  role: UserRole;
  phone_number: string;
  email: string | null;
  // Set only once the email has been proven via OTP (POST
  // /profile/email/verify-otp) — NULL for an unverified/no email.
  email_verified_at: string | null;
  profile_photo_url: string | null;
  city: string | null;
  preferred_language: string | null;
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

// `email` is deliberately not part of this payload — it can only be set via
// the verified-email flow (sendEmailOtp / verifyEmailOtp below), never a
// plain PATCH, so an unverified email can never reach a profile.
export interface UpdateProfilePayload {
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

export interface Cricketer {
  name: string;
  external_id: string;
  photo_url: string | null;
}

export interface User {
  user_id: string;
  phone_number: string;
  email?: string;
  role: UserRole;
  account_status: AccountStatus;
  // Only set for PLAYER accounts (PRD §12.59, updated) — null for
  // TURF_OWNER/TURF_STAFF/ADMIN.
  bfam_id: string | null;
  google_id?: string;
  apple_id?: string;
  is_minor: boolean;
  city?: string;
  preferred_language?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Player {
  player_id: string;
  user_id: string;
  bfam_id: string;
  playing_role?: string;
  batting_style?: string;
  bowling_style?: string;
  experience_level?: string;
  skill_rating: number;
  reliability_score: number;
  bio?: string;
  date_of_birth?: string;
  favorite_cricketer_name?: string;
  favorite_cricketer_external_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export type PaymentMethod = 'UPI' | 'CASH' | 'CAPTAIN_PAYS' | 'SPLIT' | 'CARD';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Payment {
  payment_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id?: string;
  payment_status: PaymentStatus;
  collected_by?: string;
  cash_reference?: string;
  initiated_at: string;
  completed_at?: string;
}

export type AudioTriggerType =
  | 'SIX'
  | 'FOUR'
  | 'WICKET'
  | 'FIFTY'
  | 'CENTURY'
  | 'HAT_TRICK'
  | 'MATCH_WON'
  | 'TOSS'
  | 'COUNTDOWN_START'
  | 'NONE';

export interface ScoreEvent {
  score_event_id: string;
  innings_id: string;
  over_number: number;
  ball_number_in_over: number;
  sequence_number: number;
  striker_player_id: string;
  non_striker_player_id: string;
  bowler_player_id: string;
  runs_scored: number;
  extra_type?: string;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type?: string;
  dismissed_player_id?: string;
  fielder_player_id?: string;
  audio_trigger: AudioTriggerType;
  recorded_by: string;
  recorded_at: string;
}

export interface Turf {
  turf_id: string;
  owner_id: string;
  turf_name: string;
  description?: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  ball_types_supported: string[];
  stadium_sound_enabled: boolean;
  turf_status: string;
  averagerating?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface MatchIntro {
  intro_id: string;
  match_id: string;
  countdown_enabled: boolean;
  background_music_enabled: boolean;
  playing_xi_confirmed_team_a: boolean;
  playing_xi_confirmed_team_b: boolean;
  intro_played_at?: string;
}

export interface LiveMatchSession {
  viewer_session_id: string;
  match_id: string;
  user_id?: string;
  socket_id: string;
  connected_at: string;
  disconnected_at?: string;
}
