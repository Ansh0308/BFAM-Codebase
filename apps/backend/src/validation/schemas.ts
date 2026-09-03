import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  AUDIO_TRIGGERS,
  BALL_TYPES,
  BATTING_STYLES,
  BLOCK_REASONS,
  BOOKING_STATUSES,
  BOWLING_ARMS,
  DAY_TYPES,
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  DUE_STATUSES,
  EXPERIENCE_LEVELS,
  EXTRA_TYPES,
  GENDERS,
  INNINGS_STATUSES,
  INVITATION_STATUSES,
  MATCH_STATUSES,
  MATCH_TYPES,
  MATCH_VISIBILITIES,
  MEMBERSHIP_STATUSES,
  PARTICIPANT_ROLES,
  PAYMENT_METHODS,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  PLAYING_ROLES,
  RATING_DIMENSIONS,
  RATING_EVENT_TYPES,
  REFUND_STATUSES,
  REPLACEMENT_STATUSES,
  RESULT_TYPES,
  SCORING_MODES,
  SIDE_LABELS,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  TEAM_MEMBER_ROLES,
  TEAM_SKILL_LEVELS,
  TEAM_STATUSES,
  TURF_STATUSES,
  USER_ROLES,
  WICKET_TYPES,
  NOTIFICATION_TYPES,
} from '../domain/constants';

const uuid = z.string().uuid();
const timestamp = z.coerce.date();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeOnly = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const decimalString = z.union([z.string(), z.number()]).transform(String);

export const userSchema = z.object({
  user_id: uuid,
  phone_number: z.string().max(15),
  email: z.string().email().max(255).nullable().optional(),
  password_hash: z.string().max(255),
  role: z.enum(USER_ROLES),
  account_status: z.enum(ACCOUNT_STATUSES),
  phone_verified_at: timestamp.nullable().optional(),
  profile_photo_url: z.string().url().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  preferred_language: z.string().max(10).nullable().optional(),
  bfam_id: z
    .string()
    .regex(/^BF\d+$/)
    .max(15),
  google_id: z.string().max(255).nullable().optional(),
  apple_id: z.string().max(255).nullable().optional(),
  is_minor: z.boolean(),
  last_login_at: timestamp.nullable().optional(),
});

// Registration payload accepted by POST /auth/register. Deliberately a
// smaller subset of userSchema: only the columns a caller can/should supply
// at signup. `password` is plaintext input that the route hashes into
// `password_hash` before insert — it is never persisted or echoed back.
// `bfam_id` is intentionally absent: it is assigned server-side by the
// atomic allocator (PRD §12.59), never supplied by the client.
export const registerUserSchema = z.object({
  phone_number: z.string().min(7).max(15),
  email: z.string().email().max(255).nullable().optional(),
  password: z.string().min(8).max(72),
  role: z.enum(USER_ROLES),
  city: z.string().max(100).nullable().optional(),
  preferred_language: z.string().max(10).nullable().optional(),
  is_minor: z.boolean().optional(),
  // Optional signup ticket (from POST /auth/otp/verify, purpose=SIGNUP).
  // When present and valid, marks phone_verified_at on insert.
  signup_token: z.string().optional(),
  // Optional Favorite Cricketer Search selection (PLAYER role only) —
  // persisted onto the `players` row created alongside `users`.
  favorite_cricketer_name: z.string().max(100).nullable().optional(),
  favorite_cricketer_external_id: z.string().max(50).nullable().optional(),
  // Liability waiver consent (PRD §32.9) — must be an affirmative true,
  // never defaulted or inferred. Registration is rejected outright
  // without it, so a users row with liability_waiver_accepted_at set is
  // always backed by a real acceptance, not an automatic stamp.
  waiver_accepted: z.literal(true),
});

// --- Module 2.1 auth/onboarding schemas ---

export const OTP_PURPOSES = ['SIGNUP', 'LOGIN', 'RESET_PASSWORD'] as const;

export const otpSendSchema = z.object({
  identifier: z.string().min(3).max(255),
  purpose: z.enum(OTP_PURPOSES),
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(3).max(255),
  otp: z.string().length(6),
  purpose: z.enum(OTP_PURPOSES),
});

export const loginSchema = z.object({
  identifier: z.string().min(3).max(255),
  password: z.string().min(1).max(72),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3).max(255),
});

export const resetPasswordSchema = z.object({
  reset_token: z.string().min(1),
  new_password: z.string().min(8).max(72),
});

export const googleAuthSchema = z.object({
  id_token: z.string().min(1),
});

export const appleAuthSchema = z.object({
  identity_token: z.string().min(1),
  // Apple only supplies a display name once, natively, on first sign-in —
  // the client passes it through here if it has it (never present on
  // subsequent sign-ins).
  name: z.string().max(150).nullable().optional(),
});

// Self-service signup roles only — ADMIN is never a self-service signup.
export const SELF_SERVICE_ROLES = USER_ROLES.filter((role) => role !== 'ADMIN');

export const socialCompleteSchema = z.object({
  social_ticket: z.string().min(1),
  phone_number: z.string().min(7).max(15),
  role: z.enum(SELF_SERVICE_ROLES as [string, ...string[]]),
  favorite_cricketer_name: z.string().max(100).nullable().optional(),
  favorite_cricketer_external_id: z.string().max(50).nullable().optional(),
  // Same liability waiver requirement as phone/password registration
  // (registerUserSchema) — the social signup branch must not skip it.
  waiver_accepted: z.literal(true),
});

export const playerSchema = z.object({
  player_id: uuid,
  user_id: uuid,
  bfam_id: z.string().max(15),
  playing_role: z.enum(PLAYING_ROLES).nullable().optional(),
  batting_style: z.enum(BATTING_STYLES).nullable().optional(),
  bowling_style: z.string().max(30).nullable().optional(),
  experience_level: z.enum(EXPERIENCE_LEVELS),
  skill_rating: z.number().int(),
  reliability_score: decimalString,
  bio: z.string().nullable().optional(),
  date_of_birth: dateOnly.nullable().optional(),
  favorite_cricketer_name: z.string().max(100).nullable().optional(),
  favorite_cricketer_external_id: z.string().max(50).nullable().optional(),
});

export const tableSchemas = {
  users: userSchema,
  players: playerSchema,
  teams: z.object({
    team_id: uuid,
    team_name: z.string().max(100),
    team_logo_url: z.string().url().max(500).nullable().optional(),
    description: z.string().nullable().optional(),
    skill_level: z.enum(TEAM_SKILL_LEVELS).nullable().optional(),
    home_city: z.string().max(100).nullable().optional(),
    is_open_for_players: z.boolean(),
    team_status: z.enum(TEAM_STATUSES),
    created_by: uuid,
  }),
  team_members: z.object({
    team_member_id: uuid,
    team_id: uuid,
    player_id: uuid,
    role_in_team: z.enum(TEAM_MEMBER_ROLES),
    membership_status: z.enum(MEMBERSHIP_STATUSES),
    joined_at: timestamp,
    left_at: timestamp.nullable().optional(),
  }),
  team_invitations: z.object({
    invitation_id: uuid,
    team_id: uuid,
    invited_player_id: uuid,
    invited_by: uuid,
    status: z.enum(INVITATION_STATUSES),
    created_at: timestamp,
    responded_at: timestamp.nullable().optional(),
    expires_at: timestamp.nullable().optional(),
  }),
  team_join_requests: z.object({
    request_id: uuid,
    team_id: uuid,
    player_id: uuid,
    status: z.enum(INVITATION_STATUSES),
    requested_at: timestamp,
    responded_by: uuid.nullable().optional(),
  }),
  turfs: z.object({
    turf_id: uuid,
    owner_id: uuid,
    turf_name: z.string().max(150),
    description: z.string().nullable().optional(),
    address_line: z.string().max(255),
    city: z.string().max(100),
    latitude: decimalString,
    longitude: decimalString,
    ball_types_supported: z.array(z.enum(BALL_TYPES)).nullable().optional(),
    stadium_sound_enabled: z.boolean(),
    turf_status: z.enum(TURF_STATUSES),
    average_rating: decimalString.nullable().optional(),
  }),
  bookings: z.object({
    booking_id: uuid,
    turf_id: uuid,
    booked_by: uuid,
    booking_date: dateOnly,
    start_time: timeOnly,
    end_time: timeOnly,
    duration_minutes: z.number().int(),
    booking_amount: decimalString,
    booking_status: z.enum(BOOKING_STATUSES),
    payment_mode: z.enum(PAYMENT_MODES),
    cancellation_reason: z.string().max(255).nullable().optional(),
    cancelled_at: timestamp.nullable().optional(),
    cancelled_by: uuid.nullable().optional(),
  }),
  matches: z.object({
    match_id: uuid,
    booking_id: uuid,
    match_name: z.string().max(150).nullable().optional(),
    organizer_id: uuid,
    match_type: z.enum(MATCH_TYPES),
    ball_type: z.enum(BALL_TYPES),
    overs_per_innings: z.number().int(),
    scoring_mode: z.enum(SCORING_MODES),
    assigned_scorer_id: uuid.nullable().optional(),
    match_status: z.enum(MATCH_STATUSES),
    visibility: z.enum(MATCH_VISIBILITIES),
    scheduled_start_time: timestamp,
    actual_start_time: timestamp.nullable().optional(),
    actual_end_time: timestamp.nullable().optional(),
  }),
  score_events: z.object({
    score_event_id: uuid,
    innings_id: uuid,
    over_number: z.number().int(),
    ball_number_in_over: z.number().int(),
    sequence_number: z.number().int(),
    runs_scored: z.number().int(),
    extra_type: z.enum(EXTRA_TYPES),
    extra_runs: z.number().int(),
    is_wicket: z.boolean(),
    wicket_type: z.enum(WICKET_TYPES).nullable().optional(),
    audio_trigger: z.enum(AUDIO_TRIGGERS),
    recorded_by: uuid,
  }),
  innings: z.object({
    innings_id: uuid,
    match_id: uuid,
    innings_number: z.number().int(),
    innings_status: z.enum(INNINGS_STATUSES),
  }),
  match_results: z.object({
    result_id: uuid,
    match_id: uuid,
    result_type: z.enum(RESULT_TYPES),
    finalized_by: uuid,
  }),
  player_rating_events: z.object({
    rating_event_id: uuid,
    player_id: uuid,
    event_type: z.enum(RATING_EVENT_TYPES),
    rating_dimension: z.enum(RATING_DIMENSIONS),
    rating_delta: decimalString,
  }),
  payments: z.object({
    payment_id: uuid,
    payer_id: uuid,
    amount: decimalString,
    currency: z.string().length(3),
    payment_method: z.enum(PAYMENT_METHODS),
    gateway: z.string().max(30),
    gateway_order_id: z.string().max(100),
    gateway_payment_id: z.string().max(100).nullable().optional(),
    collected_by: uuid.nullable().optional(),
    cash_reference: z.string().max(100).nullable().optional(),
    payment_status: z.enum(PAYMENT_STATUSES),
    initiated_at: timestamp,
    completed_at: timestamp.nullable().optional(),
  }),
  payment_obligations: z.object({
    obligation_id: uuid,
    booking_id: uuid,
    player_id: uuid.nullable().optional(),
    amount_due: decimalString,
    due_status: z.enum(DUE_STATUSES),
  }),
  payment_events: z.object({
    event_id: uuid,
    payment_id: uuid,
    event_type: z.string().max(50),
    raw_payload: z.record(z.unknown()),
    received_at: timestamp,
  }),
  refunds: z.object({ refund_id: uuid, payment_id: uuid, refund_status: z.enum(REFUND_STATUSES) }),
  match_teams: z.object({ match_team_id: uuid, match_id: uuid, side_label: z.enum(SIDE_LABELS) }),
  match_players: z.object({
    match_player_id: uuid,
    match_id: uuid,
    player_id: uuid,
    participant_role: z.enum(PARTICIPANT_ROLES),
    attendance_status: z.enum(ATTENDANCE_STATUSES),
  }),
  player_replacements: z.object({
    replacement_id: uuid,
    match_id: uuid,
    vacating_player_id: uuid,
    initiated_by: uuid,
    status: z.enum(REPLACEMENT_STATUSES),
  }),
  notifications: z.object({
    notification_id: uuid,
    user_id: uuid,
    notification_type: z.enum(NOTIFICATION_TYPES),
    delivery_channel: z.enum(DELIVERY_CHANNELS),
    delivery_status: z.enum(DELIVERY_STATUSES),
  }),
  support_tickets: z.object({
    ticket_id: uuid,
    raised_by: uuid,
    category: z.enum(SUPPORT_CATEGORIES),
    description: z.string(),
    status: z.enum(SUPPORT_STATUSES),
  }),
  turf_pricing: z.object({
    pricing_id: uuid,
    turf_id: uuid,
    day_type: z.enum(DAY_TYPES),
    start_time: timeOnly,
    end_time: timeOnly,
    price_per_hour: decimalString,
    currency: z.string().length(3),
    effective_from: dateOnly,
    effective_to: dateOnly.nullable().optional(),
  }),
  turf_staff_assignments: z.object({
    assignment_id: uuid,
    turf_id: uuid,
    staff_user_id: uuid,
    permissions: z.record(z.unknown()),
    assigned_by: uuid,
    status: z.enum(ASSIGNMENT_STATUSES),
  }),
  turf_availability_blocks: z.object({
    block_id: uuid,
    turf_id: uuid,
    start_datetime: timestamp,
    end_datetime: timestamp,
    reason: z.enum(BLOCK_REASONS),
    created_by: uuid,
  }),
  turf_images: z.object({
    image_id: uuid,
    turf_id: uuid,
    image_url: z.string().url().max(500),
    display_order: z.number().int(),
  }),
  turf_facilities: z.object({
    facility_id: uuid,
    turf_id: uuid,
    facility_name: z.string().max(50),
  }),
  turf_operating_hours: z.object({
    hours_id: uuid,
    turf_id: uuid,
    day_of_week: z.number().int().min(0).max(6),
    open_time: timeOnly,
    close_time: timeOnly,
  }),
  match_invitations: z.object({
    invitation_id: uuid,
    match_id: uuid,
    invited_player_id: uuid,
    invited_by: uuid,
    status: z.enum(INVITATION_STATUSES),
    sent_at: timestamp,
    responded_at: timestamp.nullable().optional(),
    expires_at: timestamp.nullable().optional(),
  }),
  payment_allocations: z.object({
    allocation_id: uuid,
    payment_id: uuid,
    obligation_id: uuid,
    allocated_amount: decimalString,
  }),
  player_match_statistics: z.object({
    stat_id: uuid,
    match_id: uuid,
    player_id: uuid,
    runs_scored: z.number().int(),
    balls_faced: z.number().int(),
    fours: z.number().int(),
    sixes: z.number().int(),
    strike_rate: decimalString.nullable().optional(),
    overs_bowled: decimalString,
    runs_conceded: z.number().int(),
    wickets_taken: z.number().int(),
    economy_rate: decimalString.nullable().optional(),
    catches: z.number().int(),
    run_outs: z.number().int(),
    stumpings: z.number().int(),
  }),
  match_intro: z.object({
    intro_id: uuid,
    match_id: uuid,
    countdown_enabled: z.boolean(),
    background_music_enabled: z.boolean(),
    playing_xi_confirmed_team_a: z.boolean(),
    playing_xi_confirmed_team_b: z.boolean(),
    intro_played_at: timestamp.nullable().optional(),
  }),
  live_match_sessions: z.object({
    viewer_session_id: uuid,
    match_id: uuid,
    user_id: uuid.nullable().optional(),
    socket_id: z.string().max(50),
    connected_at: timestamp,
    disconnected_at: timestamp.nullable().optional(),
  }),
  audit_logs: z.object({
    log_id: uuid,
    actor_user_id: uuid.nullable().optional(),
    actor_role: z.string().max(30).nullable().optional(),
    action: z.string().max(100),
    resource_type: z.string().max(50),
    resource_id: uuid,
    before_data: z.record(z.unknown()).nullable().optional(),
    after_data: z.record(z.unknown()).nullable().optional(),
    ip_address: z.string().max(45).nullable().optional(),
    request_id: uuid.nullable().optional(),
  }),
};

// ---- API request-shape schemas (module 2.3: Turf Discovery & Booking) ----
// These validate what a caller may send, not a table's full column set —
// same pattern as registerUserSchema above.

export const turfListQuerySchema = z.object({
  city: z.string().max(100).optional(),
  q: z.string().max(150).optional(),
  ball_type: z.enum(BALL_TYPES).optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  // Drives "Near You" distance sorting only — map view is explicitly
  // deferred (PRD §12.7 / module 2.3 scope note).
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(50).optional(),
});

export const turfAvailabilityQuerySchema = z.object({
  date: dateOnly,
});

export const createBookingSchema = z.object({
  turf_id: uuid,
  booking_date: dateOnly,
  start_time: timeOnly,
  duration_minutes: z.number().int().min(30).max(480),
  payment_mode: z.enum(PAYMENT_MODES),
});

export const cancelBookingSchema = z.object({
  cancellation_reason: z.string().max(255).optional(),
});

export const listMyBookingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past', 'all']).optional(),
});

// ---- Module 2.1: BFAM ID player-only + admin reservation schemas ----

const bfamIdFormat = z
  .string()
  .regex(/^BF\d+$/, 'BFAM ID must match the format BF<digits>, e.g. BF7');

export const lockBfamIdSchema = z.object({
  bfam_id: bfamIdFormat,
  notes: z.string().max(255).nullable().optional(),
});

export const assignBfamIdSchema = z.object({
  user_id: uuid,
});

// PATCH /profile/me — `users` fields apply to every role; the player-only
// fields are silently ignored server-side for non-PLAYER accounts (see
// services/profileService.ts) rather than rejected, since a client sending
// a full form payload shouldn't need to know the caller's role.
export const updateProfileSchema = z.object({
  // A real photo URL (S3) OR a `preset:<id>` sentinel selecting one of the
  // bundled icon avatars (see mobile's AvatarPresets.ts) — no separate
  // column exists for "which preset" so it's encoded into the same
  // VARCHAR(500) column rather than inventing a new one.
  profile_photo_url: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  preferred_language: z.string().max(10).nullable().optional(),
  // Required in Profile Setup for future analytics (product decision,
  // 2026-08-30) — enforced client-side (see profile-setup.tsx); the API
  // itself still accepts null so partial saves elsewhere don't break.
  date_of_birth: dateOnly.nullable().optional(),
  // Required in Profile Setup, same reasoning/pattern as date_of_birth
  // above (product decision, 2026-08-30).
  gender: z.enum(GENDERS).nullable().optional(),
  playing_role: z.enum(PLAYING_ROLES).nullable().optional(),
  batting_style: z.enum(BATTING_STYLES).nullable().optional(),
  bowling_style: z.enum(BOWLING_ARMS).nullable().optional(),
  experience_level: z.enum(EXPERIENCE_LEVELS).optional(),
});

// POST /profile/email/send-otp and /verify-otp — optional post-signup
// secondary contact (PRD update — no longer collected at signup), but must
// be proven via OTP before it's saved (product decision, 2026-08-30). Not
// part of updateProfileSchema above — that path never accepts an
// unverified email.
export const sendEmailOtpSchema = z.object({
  email: z.string().email().max(255),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().email().max(255),
  otp: z.string().length(6),
});

// ---- Module 2.4: Payments ----

export const createObligationsSchema = z.object({
  shares: z
    .array(
      z.object({
        player_id: uuid.nullable(),
        amount: z.number().positive(),
      }),
    )
    .min(1)
    .optional(),
});

export const initiateGatewayPaymentSchema = z.object({
  obligation_ids: z.array(uuid).min(1),
  payment_method: z.enum(['UPI', 'RAZORPAY']),
});

export const cashPaymentSchema = z.object({
  obligation_ids: z.array(uuid).min(1),
  cash_reference: z.string().max(100).optional(),
});

// ---- Module 2.5: Teams ----

export const createTeamSchema = z.object({
  team_name: z.string().min(2).max(100),
  team_logo_url: z.string().url().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  skill_level: z.enum(TEAM_SKILL_LEVELS).nullable().optional(),
  home_city: z.string().max(100).nullable().optional(),
  is_open_for_players: z.boolean().optional(),
});

export const inviteToTeamSchema = z.object({
  player_id: uuid,
});

export const respondToInvitationSchema = z.object({
  accept: z.boolean(),
});

export const changeCaptainSchema = z.object({
  new_captain_player_id: uuid,
});

export const openTeamsQuerySchema = z.object({
  skill_level: z.enum(TEAM_SKILL_LEVELS).optional(),
  city: z.string().max(100).optional(),
});

// ---- Module 2.6: Match Creation & Game Room ----

export const createMatchSchema = z.object({
  booking_id: uuid,
  match_name: z.string().max(150).nullable().optional(),
  match_type: z.enum(MATCH_TYPES),
  ball_type: z.enum(BALL_TYPES),
  overs_per_innings: z.number().int().min(1).max(50),
  scoring_mode: z.enum(SCORING_MODES),
  assigned_scorer_id: uuid.nullable().optional(),
});

export const inviteToMatchSchema = z.object({
  player_id: uuid,
});

export const respondToMatchInvitationSchema = z.object({
  response: z.enum(['CONFIRMED', 'MAYBE', 'CANT_PLAY']),
});

export const updateAttendanceSchema = z.object({
  attendance_status: z.enum(ATTENDANCE_STATUSES),
});

export const checkInSchema = z.object({
  code: z.string().min(1).max(8),
});

export const inviteReplacementSchema = z.object({
  player_id: uuid,
});

// ---- Module 2.7: Countdown Intro ----

export const confirmPlayingXiSchema = z.object({
  side: z.enum(['TEAM_A', 'TEAM_B']),
});

export const recordTossSchema = z.object({
  toss_winner_match_team_id: uuid,
  decision: z.enum(['BAT', 'BOWL']),
});

// ---- Module 2.8: Live Scoring ----

export const startInningsSchema = z.object({
  innings_number: z.number().int().min(1),
  batting_match_team_id: uuid,
  bowling_match_team_id: uuid,
  target_runs: z.number().int().min(0).nullable().optional(),
});

export const recordBallSchema = z.object({
  striker_player_id: uuid,
  non_striker_player_id: uuid.nullable().optional(),
  bowler_player_id: uuid,
  runs_scored: z.number().int().min(0).max(6),
  extra_type: z.enum(EXTRA_TYPES),
  extra_runs: z.number().int().min(0).max(6),
  is_wicket: z.boolean(),
  wicket_type: z.enum(WICKET_TYPES).nullable().optional(),
  dismissed_player_id: uuid.nullable().optional(),
  fielder_player_id: uuid.nullable().optional(),
});

export const finalizeMatchSchema = z.object({
  result_type: z.enum(RESULT_TYPES),
  winning_match_team_id: uuid.nullable().optional(),
  winning_margin: z.string().max(50).nullable().optional(),
  player_of_the_match_id: uuid.nullable().optional(),
});

// ---- Module 2.12: Turf Owner & Turf Staff ----

export const createTurfSchema = z.object({
  turf_name: z.string().min(2).max(150),
  description: z.string().max(2000).nullable().optional(),
  address_line: z.string().min(2).max(255),
  city: z.string().min(2).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  ball_types_supported: z.array(z.enum(BALL_TYPES)).optional(),
});

export const updateTurfSchema = createTurfSchema.partial();

export const setSoundSettingSchema = z.object({
  stadium_sound_enabled: z.boolean(),
});

export const setPricingSchema = z.object({
  rows: z.array(
    z.object({
      day_type: z.enum(DAY_TYPES),
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      price_per_hour: z.number().min(0),
    }),
  ),
});

export const setOperatingHoursSchema = z.object({
  rows: z.array(
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    }),
  ),
});

export const createAvailabilityBlockSchema = z.object({
  start_datetime: z.string().datetime().or(z.string().min(10)),
  end_datetime: z.string().datetime().or(z.string().min(10)),
  reason: z.enum(BLOCK_REASONS),
});

export const assignStaffSchema = z.object({
  staff_user_id: uuid,
});

export const reviewVerificationSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejection_reason: z.string().max(500).nullable().optional(),
});

export const submitVerificationDocumentSchema = z.object({
  turf_id: uuid,
  document_url: z.string().url(),
});

// ---- Module 2.13: Support ----

export const createComplaintSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  description: z.string().min(5).max(2000),
  related_entity_type: z.string().max(50).nullable().optional(),
  related_entity_id: uuid.nullable().optional(),
});

export const createMatchDisputeSchema = z.object({
  match_id: uuid,
  description: z.string().min(5).max(2000),
});

export const createInjuryReportSchema = z.object({
  description: z.string().min(5).max(2000),
  match_id: uuid.nullable().optional(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(SUPPORT_STATUSES),
});
