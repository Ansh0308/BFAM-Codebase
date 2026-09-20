// Notification templates (module 2.11, PRD §12.45). Pure and DB-free so the
// "every PRD event has a registered template" guarantee (this module's
// requirement 4) can be unit-tested directly, without spinning up the
// service layer or a database.
//
// PRD_NOTIFICATION_EVENTS is transcribed directly from §12.45's bullet
// list, in the PRD's own order — the test in
// __tests__/notificationTemplates.test.ts iterates exactly this array, so
// adding a new PRD event without a matching entry in NOTIFICATION_TEMPLATES
// fails CI rather than silently shipping unnotified.
export const PRD_NOTIFICATION_EVENTS = [
  'BOOKING_CONFIRMATION', // "Booking confirmation"
  'MATCH_INVITATION', // "Match invitation"
  'PLAYER_CONFIRMATION', // "Player confirmation"
  'MATCH_REMINDER', // "Match reminder"
  'PAYMENT_REMINDER', // "Payment reminder"
  'PLAYER_CANCELLATION', // "Player cancellation"
  'REPLACEMENT_REQUEST', // "Replacement request"
  'REPLACEMENT_ACCEPTED', // "Replacement accepted"
  'MATCH_STARTING', // "Match starting"
  'MATCH_RESULT', // "Match result"
  'RATING_UPDATE', // "Rating update"
  'REWARD_RECEIVED', // "Reward received"
  'TOURNAMENT_UPDATE', // "Tournament update"
] as const;

export type PrdNotificationEvent = (typeof PRD_NOTIFICATION_EVENTS)[number];

// A notification_type this codebase used before module 2.11 (kept for
// backward compatibility, e.g. TEAM_INVITE is used outside the §12.45 list)
// plus every PRD event above, plus NEW_MESSAGE (backlog B-3) and
// PLAYER_PLAYING (backlog B-9) — neither in the original PRD §12.45 list,
// added the same way TEAM_INVITE/BOOKING_UPDATE were — the full set
// notificationService can send.
export type NotificationEventType =
  | PrdNotificationEvent
  | 'TEAM_INVITE'
  | 'BOOKING_UPDATE'
  | 'NEW_MESSAGE'
  | 'PLAYER_PLAYING'
  | 'CHALLENGE_RECEIVED'
  | 'CHALLENGE_ACCEPTED'
  | 'CHALLENGE_DECLINED';

export type NotificationPreferenceCategory =
  'match_updates' | 'booking_reminders' | 'team_invites' | 'promotions';

export interface NotificationTemplate<Params = Record<string, string>> {
  // Which Notification Settings (module 2.2) toggle this event is gated by.
  category: NotificationPreferenceCategory;
  title: (params: Params) => string;
  body: (params: Params) => string;
}

// Every value here is intentionally a plain string-keyed function — simple
// enough to unit test exhaustively, and easy for a reviewer to audit
// against the PRD bullet list side by side.
// Each template's params type below is genuinely different; `any` here is
// the registry's necessarily-erased common type, not a shortcut around
// typing an individual template.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NOTIFICATION_TEMPLATES: Record<NotificationEventType, NotificationTemplate<any>> = {
  BOOKING_CONFIRMATION: {
    category: 'booking_reminders',
    title: () => 'Booking confirmed',
    body: (p: { date: string; time: string }) =>
      `Your slot on ${p.date} at ${p.time} is confirmed — all dues are settled.`,
  },
  MATCH_INVITATION: {
    category: 'match_updates',
    title: () => 'Match invitation',
    body: (p: { matchName: string }) => `You've been invited to play in ${p.matchName}.`,
  },
  PLAYER_CONFIRMATION: {
    category: 'match_updates',
    title: () => 'Player confirmed',
    body: (p: { playerBfamId: string; matchName: string }) =>
      `${p.playerBfamId} confirmed for ${p.matchName}.`,
  },
  MATCH_REMINDER: {
    category: 'booking_reminders',
    title: () => 'Match reminder',
    body: (p: { matchName: string; timeUntil: string }) =>
      `${p.matchName} starts in ${p.timeUntil}.`,
  },
  PAYMENT_REMINDER: {
    category: 'booking_reminders',
    title: () => 'Payment reminder',
    body: (p: { matchName: string; amountDue: string }) =>
      `₹${p.amountDue} is still due for ${p.matchName}.`,
  },
  PLAYER_CANCELLATION: {
    category: 'match_updates',
    title: () => 'Player cancelled',
    body: (p: { playerBfamId: string; matchName: string }) =>
      `${p.playerBfamId} can no longer play in ${p.matchName}.`,
  },
  REPLACEMENT_REQUEST: {
    category: 'match_updates',
    title: () => 'Replacement needed',
    body: (p: { matchName: string }) => `You've been asked to fill a spot in ${p.matchName}.`,
  },
  REPLACEMENT_ACCEPTED: {
    category: 'match_updates',
    title: () => 'Replacement confirmed',
    body: (p: { playerBfamId: string; matchName: string }) =>
      `${p.playerBfamId} filled the open spot in ${p.matchName}.`,
  },
  MATCH_STARTING: {
    category: 'match_updates',
    title: () => 'Match starting',
    body: (p: { matchName: string }) => `${p.matchName} is starting now.`,
  },
  MATCH_RESULT: {
    category: 'match_updates',
    title: () => 'Match result',
    body: (p: { matchName: string; resultSummary: string }) => `${p.matchName}: ${p.resultSummary}`,
  },
  RATING_UPDATE: {
    category: 'match_updates',
    title: () => 'Rating updated',
    body: (p: { newRating: string }) => `Your BFAM Skill Rating is now ${p.newRating}.`,
  },
  REWARD_RECEIVED: {
    category: 'promotions',
    title: () => 'Reward received',
    body: (p: { rewardName: string }) => `You've received ${p.rewardName}.`,
  },
  TOURNAMENT_UPDATE: {
    category: 'promotions',
    title: () => 'Tournament update',
    body: (p: { tournamentName: string; update: string }) => `${p.tournamentName}: ${p.update}`,
  },
  TEAM_INVITE: {
    category: 'team_invites',
    title: () => 'Team invite',
    body: (p: { teamName: string }) => `You've been invited to join ${p.teamName}.`,
  },
  BOOKING_UPDATE: {
    category: 'booking_reminders',
    title: () => 'Booking update',
    body: (p: { message: string }) => p.message,
  },
  // Backlog B-3: a new message (from another player, or a system event
  // like check-in/payment) in a match's chat room.
  NEW_MESSAGE: {
    category: 'match_updates',
    title: (p: { matchName: string }) => `New message in ${p.matchName}`,
    body: (p: { preview: string }) => p.preview,
  },
  // Backlog B-9: "notify a user whenever someone they follow plays a
  // match" — fired at the same moment MATCH_STARTING fires for the
  // roster itself (matchIntroService.startIntro).
  PLAYER_PLAYING: {
    category: 'match_updates',
    title: (p: { playerName: string }) => `${p.playerName} is playing`,
    body: (p: { playerName: string; matchName: string }) =>
      `${p.playerName} just started playing in ${p.matchName}.`,
  },
  // Backlog B-13: Team vs Team Challenge Mode.
  CHALLENGE_RECEIVED: {
    category: 'team_invites',
    title: (p: { teamName: string }) => `Challenge from ${p.teamName}`,
    body: (p: { teamName: string }) => `${p.teamName} has challenged your team to a match.`,
  },
  CHALLENGE_ACCEPTED: {
    category: 'team_invites',
    title: (p: { teamName: string }) => `${p.teamName} accepted your challenge`,
    body: (p: { teamName: string }) =>
      `${p.teamName} accepted your challenge. Time to book a turf.`,
  },
  CHALLENGE_DECLINED: {
    category: 'team_invites',
    title: (p: { teamName: string }) => `${p.teamName} declined your challenge`,
    body: (p: { teamName: string }) => `${p.teamName} declined your challenge.`,
  },
};
