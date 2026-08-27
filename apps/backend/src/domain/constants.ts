export const USER_ROLES = ['PLAYER', 'TURF_OWNER', 'TURF_STAFF', 'ADMIN'] as const;
export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;

export const PLAYING_ROLES = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const;
export const BATTING_STYLES = ['RIGHT_HANDED', 'LEFT_HANDED'] as const;
export const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

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
export const ATTENDANCE_STATUSES = ['PENDING', 'CHECKED_IN', 'NO_SHOW'] as const;
export const REPLACEMENT_STATUSES = ['OPEN', 'FILLED', 'CANCELLED'] as const;

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

export const NOTIFICATION_TYPES = [
  'MATCH_REMINDER',
  'BOOKING_UPDATE',
  'PAYMENT_UPDATE',
  'TEAM_INVITE',
] as const;
export const DELIVERY_CHANNELS = ['PUSH', 'EMAIL', 'SMS', 'IN_APP'] as const;
export const DELIVERY_STATUSES = ['PENDING', 'DELIVERED', 'FAILED', 'READ'] as const;
export const SUPPORT_CATEGORIES = [
  'PAYMENT_ISSUE',
  'BOOKING_ISSUE',
  'MATCH_ISSUE',
  'ACCOUNT_ISSUE',
  'OTHER',
] as const;
export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
