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

// (Payment / PaymentMethodType / PaymentStatusType are defined below, under
// "Module 2.4: Payments" — this used to be a Phase 0 placeholder with a
// payment_method enum that didn't match the real DB/domain constants.)

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
  // Matches the actual DB/model column name (average_rating) — the previous
  // `averagerating` field name here didn't match the schema.
  average_rating?: number | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

// ---- Module 2.3: Turf Discovery & Booking ----

export interface TurfListItem {
  turf_id: string;
  turf_name: string;
  city: string;
  address_line: string;
  ball_types_supported: string[];
  average_rating: number | null;
  cover_image_url: string | null;
  min_price_per_hour: number | null;
  distance_km: number | null;
}

export interface TurfListResponse {
  page: number;
  page_size: number;
  results: TurfListItem[];
}

export interface TurfImage {
  image_id: string;
  image_url: string;
  display_order: number;
}

export interface TurfFacility {
  facility_id: string;
  facility_name: string;
}

export interface TurfOperatingHours {
  hours_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
}

export interface TurfPricingRule {
  pricing_id: string;
  day_type: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  start_time: string;
  end_time: string;
  price_per_hour: string;
  currency: string;
}

export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

export interface AvailabilitySlot {
  start_time: string;
  end_time: string;
  status: SlotStatus;
  price_per_hour: number | null;
}

export interface TurfAvailability {
  turf_id: string;
  date: string;
  day_type: 'WEEKDAY' | 'WEEKEND';
  slots: AvailabilitySlot[];
}

export interface TurfDetails extends Turf {
  images: TurfImage[];
  facilities: TurfFacility[];
  operating_hours: TurfOperatingHours[];
  pricing: TurfPricingRule[];
  availability_preview: { date: string; slots: AvailabilitySlot[] } | null;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Booking {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  booking_amount: number | string;
  booking_status: BookingStatus;
  payment_mode: string;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at: string;
  updated_at: string;
  turf_name?: string;
  city?: string;
}

export interface CreateBookingInput {
  turf_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  payment_mode: string;
}

// ---- Module 2.4: Payments ----

export type ObligationDueStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface PaymentObligation {
  obligation_id: string;
  booking_id: string;
  player_id: string | null;
  amount_due: number | string;
  due_status: ObligationDueStatus;
  created_at: string;
  updated_at: string;
}

export type PaymentMethodType = 'UPI' | 'RAZORPAY' | 'CASH' | 'CAPTAIN_PAYS' | 'SPLIT';
export type PaymentStatusType = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Payment {
  payment_id: string;
  payer_id: string;
  amount: number | string;
  currency: string;
  payment_method: PaymentMethodType;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id?: string | null;
  collected_by?: string | null;
  cash_reference?: string | null;
  payment_status: PaymentStatusType;
  initiated_at: string;
  completed_at?: string | null;
}

export interface CreateObligationsInput {
  shares?: { player_id: string | null; amount: number }[];
}

export interface GatewayPaymentOrder {
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

// ---- Module 2.5: Teams ----

export type TeamSkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'MIXED';
export type TeamStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type TeamMemberRole = 'CAPTAIN' | 'MEMBER';
export type MembershipStatus = 'ACTIVE' | 'LEFT' | 'REMOVED';

export interface Team {
  team_id: string;
  team_name: string;
  team_logo_url: string | null;
  description: string | null;
  skill_level: TeamSkillLevel | null;
  home_city: string | null;
  is_open_for_players: boolean;
  team_status: TeamStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  team_member_id: string;
  team_id: string;
  player_id: string;
  role_in_team: TeamMemberRole;
  membership_status: MembershipStatus;
  joined_at: string;
  left_at: string | null;
  bfam_id?: string;
  favorite_cricketer_name?: string | null;
}

export interface TeamDetails extends Team {
  members: TeamMember[];
}

export interface MyTeam extends Team {
  role_in_team: TeamMemberRole;
}

export interface OpenTeam extends Team {
  active_member_count: number;
}

export interface CreateTeamInput {
  team_name: string;
  team_logo_url?: string | null;
  description?: string | null;
  skill_level?: TeamSkillLevel | null;
  home_city?: string | null;
  is_open_for_players?: boolean;
}

export interface JoinRequest {
  request_id: string;
  team_id: string;
  player_id: string;
  status: string;
  requested_at: string;
  responded_by: string | null;
  bfam_id?: string;
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
