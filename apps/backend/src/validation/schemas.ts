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
  DAY_TYPES,
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  DUE_STATUSES,
  EXPERIENCE_LEVELS,
  EXTRA_TYPES,
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
