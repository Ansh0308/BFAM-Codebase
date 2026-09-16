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
  // Backlog A-9 — shown in place of the BFAM ID everywhere a player is
  // listed (roster rows, scoring selectors, invite lists).
  full_name: string | null;
  // Backlog B-1/B-4 — BFAM Coins balance; null for non-PLAYER roles.
  coin_balance: number | null;
  // Backlog B-9 follow-up: the same counts shown on another player's
  // public profile, now also shown on your own; null for non-PLAYER roles.
  follow_summary: FollowSummary | null;
}

// Backlog B-10: another player's profile, viewed from a roster/team row.
// Deliberately a much smaller shape than MyProfile — see
// profileService.getPublicProfile (backend) for what's excluded and why.
// Backlog B-9: follower/following counts, plus whether the viewer
// currently follows this player.
export interface FollowSummary {
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

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
  favorite_cricketer_name: string | null;
  follow_summary: FollowSummary;
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
  full_name?: string | null;
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
// payment_method enum that didn't match the real DB/domain constants.
// ScoreEvent / AudioTrigger were the same story — defined below, under
// "Module 2.8: Live Scoring", matching the real domain constants/schema
// rather than this file's original Phase 0 placeholder shape.)

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
  // Backlog A-2 — null for a standalone turf (the vast majority today).
  // When set, address/city/lat/long are auto-filled from and locked to the
  // venue, so every existing consumer of these fields keeps working as-is.
  venue_id?: string | null;
  venue_name?: string | null;
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
  venue_id: string | null;
  venue_name: string | null;
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

export interface SiblingPitch {
  turf_id: string;
  turf_name: string;
  min_price_per_hour: number | null;
}

export interface TurfDetails extends Turf {
  images: TurfImage[];
  facilities: TurfFacility[];
  operating_hours: TurfOperatingHours[];
  pricing: TurfPricingRule[];
  availability_preview: { date: string; slots: AvailabilitySlot[] } | null;
  // Other pitches at the same venue (backlog A-2) — empty when venue_id is
  // null. Each is its own independently bookable turf.
  sibling_pitches: SiblingPitch[];
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

// Backlog B-1: promo code / BFAM Coins checkout discount.
export interface CheckoutDiscountResult {
  obligation_id: string;
  original_amount_due: number;
  promo_discount: number;
  coins_spent: number;
  coin_discount: number;
  new_amount_due: number;
  coin_balance: number;
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
  // Backlog B-8: minimum Basic Skill Rating required to join; null = no constraint.
  min_skill_rating: number | null;
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
  full_name?: string | null;
  favorite_cricketer_name?: string | null;
}

// Backlog B-2: one registered player matched from the caller's device
// contacts — phone_number echoes back exactly the string the caller sent,
// so the mobile client can map it back to the specific contact entry.
export interface ContactMatch {
  phone_number: string;
  player_id: string;
  bfam_id: string;
  full_name: string | null;
}

export interface TeamDetails extends Team {
  members: TeamMember[];
}

export interface MyTeam extends Team {
  role_in_team: TeamMemberRole;
}

export interface OpenTeam extends Team {
  active_member_count: number;
  /** Backlog B-5: average reliability_score across active members, rounded; null if the team has no active members yet. */
  fair_play_score: number | null;
}

export interface CreateTeamInput {
  team_name: string;
  team_logo_url?: string | null;
  description?: string | null;
  skill_level?: TeamSkillLevel | null;
  home_city?: string | null;
  is_open_for_players?: boolean;
  min_skill_rating?: number | null;
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

// ---- Module 2.6: Match Creation & Game Room ----

export type MatchType = 'FRIENDS' | 'FAIR_PLAY' | 'TOURNAMENT';
export type MatchBallType = 'TENNIS' | 'HARD_TENNIS';
export type MatchScoringMode = 'PLAYER_MANAGED' | 'TURF_STAFF_MANAGED';
export type MatchStatus =
  'OPEN' | 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MatchConfirmationStatus =
  'PENDING' | 'CONFIRMED' | 'MAYBE' | 'CANT_PLAY' | 'NO_RESPONSE';
export type MatchAttendanceStatus = 'PENDING' | 'RUNNING_LATE' | 'CHECKED_IN' | 'NO_SHOW';
export type ReplacementStatus = 'OPEN' | 'FILLED' | 'CANCELLED';

export interface Match {
  match_id: string;
  booking_id: string;
  match_name: string | null;
  organizer_id: string;
  match_type: MatchType;
  ball_type: MatchBallType;
  overs_per_innings: number;
  scoring_mode: MatchScoringMode;
  assigned_scorer_id: string | null;
  match_status: MatchStatus;
  visibility: 'PRIVATE' | 'PUBLIC';
  scheduled_start_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  check_in_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchPlayer {
  match_player_id: string;
  match_id: string;
  player_id: string;
  match_team_id: string | null;
  participant_role: 'PLAYER' | 'CAPTAIN' | 'SCORER';
  invitation_status: MatchConfirmationStatus;
  attendance_status: MatchAttendanceStatus;
  checked_in_at: string | null;
  added_at: string;
  bfam_id?: string;
  full_name?: string | null;
  favorite_cricketer_name?: string | null;
  side_label?: string | null;
}

export interface GameRoomAttendanceSummary {
  confirmed: number;
  maybe: number;
  cant_play: number;
  pending: number;
  checked_in: number;
  running_late: number;
  no_show: number;
}

export interface GameRoom extends Match {
  players: MatchPlayer[];
  payment: {
    total_due: number;
    total_paid: number;
    fully_paid: boolean;
  };
  attendance_summary: GameRoomAttendanceSummary;
}

export interface CreateMatchInput {
  booking_id: string;
  match_name?: string | null;
  match_type: MatchType;
  ball_type: MatchBallType;
  overs_per_innings: number;
  scoring_mode: MatchScoringMode;
  assigned_scorer_id?: string | null;
  // Backlog G-20 — optional team-vs-team match; both or neither.
  home_team_id?: string | null;
  away_team_id?: string | null;
}

// Backlog G-20: a "Live Now" discovery row — a PUBLIC, IN_PROGRESS match
// with the turf and (for a team-vs-team match) both team names resolved,
// so it can be shown without a second round trip per match.
export interface LiveMatchSummary extends Match {
  turf_name: string;
  city: string;
  home_team_name: string | null;
  away_team_name: string | null;
}

export interface ReplacementSuggestion {
  player_id: string;
  bfam_id: string;
  team_name: string;
}

// ---- Module 2.8: Live Scoring ----

export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';
export type WicketType =
  'BOWLED' | 'CAUGHT' | 'RUN_OUT' | 'STUMPED' | 'LBW' | 'HIT_WICKET' | 'RETIRED';
export type AudioTrigger =
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
export type InningsStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Innings {
  innings_id: string;
  match_id: string;
  innings_number: number;
  batting_match_team_id: string;
  bowling_match_team_id: string;
  total_runs: number;
  total_wickets: number;
  overs_completed: number;
  innings_status: InningsStatus;
  target_runs: number | null;
}

export interface ScoreEvent {
  score_event_id: string;
  innings_id: string;
  over_number: number;
  ball_number_in_over: number;
  sequence_number: number;
  striker_player_id: string;
  non_striker_player_id: string | null;
  bowler_player_id: string;
  runs_scored: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: WicketType | null;
  dismissed_player_id: string | null;
  fielder_player_id: string | null;
  audio_trigger: AudioTrigger;
}

export interface RecordBallInput {
  striker_player_id: string;
  non_striker_player_id?: string | null;
  bowler_player_id: string;
  runs_scored: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type?: WicketType | null;
  dismissed_player_id?: string | null;
  fielder_player_id?: string | null;
}

export interface LiveScore {
  match_id: string;
  innings: Innings | null;
  extras_count_toward_score?: boolean;
  current_striker_player_id?: string | null;
  current_non_striker_player_id?: string | null;
  current_bowler_player_id?: string | null;
  current_run_rate?: number;
  required_run_rate?: number | null;
}

export interface BattingRow {
  player_id: string;
  bfam_id: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
}

export interface BowlingRow {
  player_id: string;
  bfam_id: string;
  overs: number;
  runs_conceded: number;
  wickets: number;
  economy: number;
}

export interface FallOfWicket {
  wicket_number: number;
  score: number;
  over: number;
  player_id: string;
  bfam_id: string;
}

export interface InningsScorecard {
  innings_id: string;
  innings_number: number;
  total_runs: number;
  total_wickets: number;
  overs_completed: number;
  batting: BattingRow[];
  bowling: BowlingRow[];
  extras: { WIDE: number; NO_BALL: number; BYE: number; LEG_BYE: number };
  fall_of_wickets: FallOfWicket[];
}

export interface Scorecard {
  match_id: string;
  extras_count_toward_score: boolean;
  innings: InningsScorecard[];
}

export interface MatchResult {
  result_id: string;
  match_id: string;
  winning_match_team_id: string | null;
  result_type: 'WIN' | 'TIE' | 'NO_RESULT';
  winning_margin: string | null;
  player_of_the_match_id: string | null;
  player_of_the_match_bfam_id?: string | null;
  finalized_at: string;
}

// Backlog B-4: post-match review reward.
export interface ReviewSubmissionResult {
  review_id: string;
  coins_awarded: number;
  coin_balance: number;
}

// Backlog B-6: Home page carousel banner / admin CMS.
export interface HomeBanner {
  banner_id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerInput {
  title: string;
  image_url: string;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export type UpdateBannerInput = Partial<CreateBannerInput>;

// Backlog B-3: Match Chat.
export interface ChatMessage {
  message_id: string;
  match_id: string;
  sender_id: string | null;
  message_type: 'TEXT' | 'SYSTEM';
  body: string;
  created_at: string;
  sender_bfam_id: string | null;
  sender_full_name: string | null;
}

export interface MatchIntro {
  intro_id: string;
  match_id: string;
  countdown_enabled: boolean;
  background_music_enabled: boolean;
  playing_xi_confirmed_team_a: boolean;
  playing_xi_confirmed_team_b: boolean;
  toss_winner_match_team_id: string | null;
  toss_decision: 'BAT' | 'BOWL' | null;
  toss_completed_at: string | null;
  intro_played_at: string | null;
}

export interface PlayingXiPlayer {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  participant_role: 'PLAYER' | 'CAPTAIN' | 'SCORER';
  side_label: 'TEAM_A' | 'TEAM_B' | null;
}

export interface IntroMatchTeam {
  match_team_id: string;
  side_label: 'TEAM_A' | 'TEAM_B';
}

export interface IntroContext {
  intro: MatchIntro;
  players: PlayingXiPlayer[];
  matchTeams: IntroMatchTeam[];
}

// ---- Module 2.10: Match Statistics & Basic Skill Rating ----

export type StatisticsScope = 'lifetime' | 'season';

export interface PlayerStatistics {
  scope: StatisticsScope;
  matches_played: number;
  runs: number;
  wickets: number;
  best_score: number | null;
  strike_rate: number | null;
  economy: number | null;
  catches: number;
  player_of_the_match_count: number;
  current_streak?: number;
}

export interface PlayerRating {
  player_id: string;
  skill_rating: number;
}

export interface RebookRosterPlayer {
  player_id: string;
  bfam_id: string;
}

export interface RebookInfo {
  turf_id: string;
  turf_name: string;
  preferred_start_time: string;
  duration_minutes: number;
  match_name: string | null;
  match_type: string;
  ball_type: string;
  overs_per_innings: number;
  scoring_mode: string;
  roster: RebookRosterPlayer[];
}

// ---- Module 2.11: Notifications ----

export type NotificationPreferenceCategory =
  'match_updates' | 'booking_reminders' | 'team_invites' | 'promotions';

export type NotificationPreferences = Record<NotificationPreferenceCategory, boolean>;

export interface Notification {
  notification_id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  delivery_channel: string;
  delivery_status: string;
  created_at: string;
  read_at: string | null;
}

// ---- Module 2.12: Turf Owner & Turf Staff ----

export interface Venue {
  venue_id: string;
  owner_id: string;
  venue_name: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  created_at?: string;
  updated_at?: string;
}

export interface VenueListItem extends Venue {
  pitch_count: number;
}

export interface VenueDetails extends Venue {
  turfs: Turf[];
}

export interface CreateVenueInput {
  venue_name: string;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  // How many pitches to create alongside the venue in this same step
  // (auto-named "Pitch 1", "Pitch 2", ...). Omit for a bare venue.
  pitch_count?: number;
}

export type UpdateVenueInput = Partial<CreateVenueInput>;

// Player-facing venue pitch-picker (Discover shows one card per venue; a
// player taps it, sees this, then picks a pitch to book).
export interface PublicVenuePitch {
  turf_id: string;
  turf_name: string;
  cover_image_url: string | null;
  min_price_per_hour: number | null;
}

export interface PublicVenueDetails {
  venue_id: string;
  venue_name: string;
  address_line: string;
  city: string;
  turfs: PublicVenuePitch[];
}

export interface CreateTurfInput {
  turf_name: string;
  description?: string | null;
  // Required unless venue_id is set, in which case address/city/lat/long
  // are auto-filled from (and locked to) the venue.
  address_line?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  ball_types_supported?: string[];
  venue_id?: string | null;
}

export type UpdateTurfInput = Partial<CreateTurfInput>;

export interface SetPricingRow {
  day_type: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  start_time: string;
  end_time: string;
  price_per_hour: number;
}

export interface SetOperatingHoursRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
}

export type AvailabilityBlockReason = 'MAINTENANCE' | 'HOLIDAY' | 'OWNER_BLOCK' | 'SYSTEM_BLOCK';

export interface TurfAvailabilityBlock {
  block_id: string;
  turf_id: string;
  start_datetime: string;
  end_datetime: string;
  reason: AvailabilityBlockReason;
  created_by: string;
  created_at: string;
}

export type StaffVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StaffAssignment {
  assignment_id: string;
  turf_id: string;
  staff_user_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  verification_status: StaffVerificationStatus;
  verification_document_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  phone_number?: string;
  turf_name?: string;
}

export interface OwnerBooking extends Booking {
  turf_name: string;
}

export interface OwnerMatch extends Match {
  turf_name: string;
}

// Digital Scoreboard (PRD §12.20) — a match currently being scored at one
// of the owner's turfs, with a score snapshot so the picker screen can
// show "142/3 (14.2 ov)" without a second round trip per match.
export interface OwnerLiveMatch extends OwnerMatch {
  turf_id: string;
  venue_id: string | null;
  venue_name: string | null;
  innings_id: string;
  total_runs: number;
  total_wickets: number;
  overs_completed: number;
}

export interface OwnerPayment extends Payment {
  turf_name: string;
}

// ---- Module 2.13: Support ----

export type SupportCategory =
  'PAYMENT_ISSUE' | 'BOOKING_ISSUE' | 'MATCH_ISSUE' | 'ACCOUNT_ISSUE' | 'OTHER';
export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type DisputeType = 'COMPLAINT' | 'MATCH_DISPUTE' | 'INJURY_REPORT';

export interface SupportTicket {
  ticket_id: string;
  raised_by: string;
  category: SupportCategory;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: SupportStatus;
  dispute_type: DisputeType;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ---- Admin Web: User management (PRD §9.1) ----

export interface AdminPlayer {
  user_id: string;
  bfam_id: string;
  phone_number: string;
  email: string | null;
  city: string | null;
  account_status: string;
  playing_role: string | null;
  batting_style: string | null;
  experience_level: string;
  skill_rating: number;
  reliability_score: number;
  favorite_cricketer_name: string | null;
  created_at: string;
}

export interface LiveMatchSession {
  viewer_session_id: string;
  match_id: string;
  user_id?: string;
  socket_id: string;
  connected_at: string;
  disconnected_at?: string;
}

// Backlog B-11: a pre-match "room" (lobby) — a new flow that runs
// alongside today's book-first match creation, not a replacement for it.
// Never linked to the persistent Team entity: a room is always disposable
// once its match starts.
export type RoomStatus = 'FILLING' | 'READY' | 'CONVERTED' | 'CANCELLED';
export type RoomPlayerSide = 'UNASSIGNED' | 'TEAM_A' | 'TEAM_B';

export interface Room {
  room_id: string;
  room_name: string;
  captain_user_id: string;
  ball_type: MatchBallType;
  overs_per_innings: number;
  max_players: number;
  room_status: RoomStatus;
  match_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenRoom extends Room {
  player_count: number;
}

export interface RoomPlayer {
  room_player_id: string;
  room_id: string;
  player_id: string;
  side: RoomPlayerSide;
  is_captain: boolean;
  joined_at: string;
  bfam_id?: string;
  full_name?: string | null;
}

export interface RoomDetails extends Room {
  players: RoomPlayer[];
}

export interface CreateRoomInput {
  room_name: string;
  ball_type: MatchBallType;
  overs_per_innings: number;
  max_players: number;
}

export interface ConvertRoomInput {
  turf_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  payment_mode: 'UPI' | 'GATEWAY' | 'CASH' | 'CAPTAIN_PAYS' | 'SPLIT_PAYMENT';
}

export interface ConvertRoomResult {
  room_id: string;
  match_id: string;
  booking_id: string;
}
