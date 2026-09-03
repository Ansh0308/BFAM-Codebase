export const USER_ROLES = ['PLAYER', 'TURF_OWNER', 'TURF_STAFF', 'ADMIN'] as const;
export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;

export const PLAYING_ROLES = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const;
export const BATTING_STYLES = ['RIGHT_HANDED', 'LEFT_HANDED'] as const;
export const BOWLING_ARMS = ['LEFT_ARM', 'RIGHT_ARM'] as const;
export const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

export const TEAM_SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED'] as const;
export const TEAM_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export const TEAM_MEMBER_ROLES = ['CAPTAIN', 'MEMBER'] as const;
export const MEMBERSHIP_STATUSES = ['ACTIVE', 'LEFT', 'REMOVED'] as const;
export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

export const TURF_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export const DAY_TYPES = ['WEEKDAY', 'WEEKEND', 'HOLIDAY'] as const;
export const ASSIGNMENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const BLOCK_REASONS = ['MAINTENANCE', 'HOLIDAY', 'OWNER_BLOCK', 'SYSTEM_BLOCK'] as const;

export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const;
export const PAYMENT_MODES = ['UPI', 'GATEWAY', 'CASH', 'CAPTAIN_PAYS', 'SPLIT_PAYMENT'] as const;

export const MATCH_TYPES = ['FRIENDS', 'FAIR_PLAY', 'TOURNAMENT'] as const;
export const BALL_TYPES = ['TENNIS', 'HARD_TENNIS'] as const;
export const SCORING_MODES = ['PLAYER_MANAGED', 'TURF_STAFF_MANAGED'] as const;
export const MATCH_STATUSES = [
  'OPEN',
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export const MATCH_VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const;
export const SIDE_LABELS = ['TEAM_A', 'TEAM_B'] as const;
export const PARTICIPANT_ROLES = ['PLAYER', 'CAPTAIN', 'SCORER'] as const;
// RUNNING_LATE added for module 2.6 (PRD §12.14) — a confirmed player
// self-reports running late without yet being marked present.
export const ATTENDANCE_STATUSES = ['PENDING', 'RUNNING_LATE', 'CHECKED_IN', 'NO_SHOW'] as const;
export const REPLACEMENT_STATUSES = ['OPEN', 'FILLED', 'CANCELLED'] as const;
// A player's RSVP to a match (module 2.6, PRD §12.9/§12.12) — distinct from
// the generic INVITATION_STATUSES used by team_invitations/
// team_join_requests, which only needs a plain accept/reject. This is its
// own enum (rather than widening the shared one) because MAYBE/CANT_PLAY/
// NO_RESPONSE would be meaningless on a team join request.
export const MATCH_CONFIRMATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'MAYBE',
  'CANT_PLAY',
  'NO_RESPONSE',
] as const;
export const REMINDER_THRESHOLDS = ['24H', '3H', '1H', '15MIN'] as const;

export const DUE_STATUSES = ['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
export const PAYMENT_METHODS = ['UPI', 'RAZORPAY', 'CASH', 'CAPTAIN_PAYS', 'SPLIT'] as const;
export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;
export const REFUND_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;

export const INNINGS_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const EXTRA_TYPES = ['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'] as const;
export const WICKET_TYPES = [
  'BOWLED',
  'CAUGHT',
  'RUN_OUT',
  'STUMPED',
  'LBW',
  'HIT_WICKET',
  'RETIRED',
] as const;
export const AUDIO_TRIGGERS = [
  'SIX',
  'FOUR',
  'WICKET',
  'FIFTY',
  'CENTURY',
  'HAT_TRICK',
  'MATCH_WON',
  'TOSS',
  'COUNTDOWN_START',
  'NONE',
] as const;
export const RESULT_TYPES = ['WIN', 'TIE', 'NO_RESULT'] as const;

export const RATING_EVENT_TYPES = [
  'MATCH_PERFORMANCE',
  'NO_SHOW',
  'FAIR_PLAY',
  'ADMIN_ADJUSTMENT',
] as const;
export const RATING_DIMENSIONS = ['SKILL', 'RELIABILITY'] as const;

// Module 2.11 (Notifications, PRD §12.45) expanded this from the Phase 1
// starter set (MATCH_REMINDER/BOOKING_UPDATE/PAYMENT_UPDATE/TEAM_INVITE) to
// one type per event PRD §12.45 lists, plus those four originals kept for
// backward compatibility. See domain/notificationTemplates.ts for the
// PRD-event -> type -> template mapping this backs.
export const NOTIFICATION_TYPES = [
  'MATCH_REMINDER',
  'BOOKING_UPDATE',
  'PAYMENT_UPDATE',
  'TEAM_INVITE',
  'BOOKING_CONFIRMATION',
  'MATCH_INVITATION',
  'PLAYER_CONFIRMATION',
  'PAYMENT_REMINDER',
  'PLAYER_CANCELLATION',
  'REPLACEMENT_REQUEST',
  'REPLACEMENT_ACCEPTED',
  'MATCH_STARTING',
  'MATCH_RESULT',
  'RATING_UPDATE',
  'REWARD_RECEIVED',
  'TOURNAMENT_UPDATE',
] as const;
export const DELIVERY_CHANNELS = ['PUSH', 'EMAIL', 'SMS', 'IN_APP'] as const;
export const DELIVERY_STATUSES = ['PENDING', 'DELIVERED', 'FAILED', 'READ'] as const;
// The four toggle categories on the Notification Settings screen (module
// 2.2) — every notification_type maps to exactly one (see
// domain/notificationTemplates.ts).
export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  'match_updates',
  'booking_reminders',
  'team_invites',
  'promotions',
] as const;
export const SUPPORT_CATEGORIES = [
  'PAYMENT_ISSUE',
  'BOOKING_ISSUE',
  'MATCH_ISSUE',
  'ACCOUNT_ISSUE',
  'OTHER',
] as const;
export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
// Module 2.13 (Support): every support_tickets row is one of these — a
// plain Help Center complaint, an in-app match dispute (PRD §32.2), or an
// injury report (PRD §32.9). All three share the same table/workflow
// (category + status), distinguished by this column rather than three
// separate tables.
export const DISPUTE_TYPES = ['COMPLAINT', 'MATCH_DISPUTE', 'INJURY_REPORT'] as const;

export const RESERVATION_STATUSES = ['LOCKED', 'ASSIGNED'] as const;

// Module 2.12 (Turf Owner & Turf Staff, PRD §32.14): a staff account is
// blocked from Check-In and Payments actions until an owner approves their
// submitted ID/document.
export const STAFF_VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
