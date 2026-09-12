// Typed domain errors for the turf discovery & booking module. Routes map
// these to clean HTTP responses instead of leaking raw DB/driver errors
// (PRD §15 requires a clean "slot no longer available" response, not a raw
// constraint-violation message).

export class TurfNotFoundError extends Error {
  constructor(turfId: string) {
    super(`Turf ${turfId} not found`);
    this.name = 'TurfNotFoundError';
  }
}

export class VenueNotFoundError extends Error {
  constructor(venueId: string) {
    super(`Venue ${venueId} not found`);
    this.name = 'VenueNotFoundError';
  }
}

export class BookingNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`Booking ${bookingId} not found`);
    this.name = 'BookingNotFoundError';
  }
}

export class SlotUnavailableError extends Error {
  constructor() {
    super('This slot is no longer available. Please choose another time.');
    this.name = 'SlotUnavailableError';
  }
}

export class SlotBlockedError extends Error {
  constructor() {
    super('This slot is blocked by the turf owner and cannot be booked.');
    this.name = 'SlotBlockedError';
  }
}

export class OutsideOperatingHoursError extends Error {
  constructor() {
    super("The selected time is outside this turf's operating hours.");
    this.name = 'OutsideOperatingHoursError';
  }
}

export class NoPricingConfiguredError extends Error {
  constructor() {
    super('No pricing is configured for this turf and time.');
    this.name = 'NoPricingConfiguredError';
  }
}

export class InvalidSlotAlignmentError extends Error {
  constructor() {
    super('Bookings must start on a valid slot boundary. Check availability first.');
    this.name = 'InvalidSlotAlignmentError';
  }
}

export class ForbiddenActionError extends Error {
  constructor(message = 'You are not allowed to perform this action.') {
    super(message);
    this.name = 'ForbiddenActionError';
  }
}

export class InvalidBookingStateError extends Error {
  constructor(message = 'This booking cannot be modified in its current state.') {
    super(message);
    this.name = 'InvalidBookingStateError';
  }
}

// ---- Module 2.4: Payments ----

export class ObligationNotFoundError extends Error {
  constructor(obligationId: string) {
    super(`Payment obligation ${obligationId} not found`);
    this.name = 'ObligationNotFoundError';
  }
}

export class PaymentNotFoundError extends Error {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} not found`);
    this.name = 'PaymentNotFoundError';
  }
}

export class InvalidPaymentStateError extends Error {
  constructor(message = 'This payment cannot be modified in its current state.') {
    super(message);
    this.name = 'InvalidPaymentStateError';
  }
}

export class AllocationExceedsObligationError extends Error {
  constructor() {
    super('This payment amount exceeds what is still owed on the selected obligation(s).');
    this.name = 'AllocationExceedsObligationError';
  }
}

export class ObligationsAlreadyExistError extends Error {
  constructor() {
    super('Payment obligations already exist for this booking.');
    this.name = 'ObligationsAlreadyExistError';
  }
}

export class GatewayNotConfiguredError extends Error {
  constructor() {
    super('The payment gateway is not configured on this server yet.');
    this.name = 'GatewayNotConfiguredError';
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Webhook signature verification failed.');
    this.name = 'InvalidWebhookSignatureError';
  }
}

// ---- Module 2.5: Teams ----

export class TeamNotFoundError extends Error {
  constructor(teamId: string) {
    super(`Team ${teamId} not found`);
    this.name = 'TeamNotFoundError';
  }
}

export class PlayerProfileNotFoundError extends Error {
  constructor() {
    super('You need a player profile to do this.');
    this.name = 'PlayerProfileNotFoundError';
  }
}

// Thrown when inviting by BFAM ID (the human-friendly identifier players
// actually know each other by, e.g. "BF1001") and no player has that ID —
// distinct from PlayerProfileNotFoundError, which is about the *caller's*
// own missing player profile.
export class PlayerNotFoundByBfamIdError extends Error {
  constructor(bfamId: string) {
    super(`No player found with BFAM ID ${bfamId}.`);
    this.name = 'PlayerNotFoundByBfamIdError';
  }
}

// Backlog B-10 — looking up someone else's public profile by their
// internal player_id (e.g. from a roster row), as opposed to
// PlayerProfileNotFoundError (the *caller's own* missing profile) or
// PlayerNotFoundByBfamIdError (looked up by BFAM ID instead).
export class PlayerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`No player found with id ${playerId}.`);
    this.name = 'PlayerNotFoundError';
  }
}

export class InvalidTeamStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTeamStateError';
  }
}

export class AlreadyTeamMemberError extends Error {
  constructor() {
    super('This player is already an active member of this team.');
    this.name = 'AlreadyTeamMemberError';
  }
}

export class JoinRequestNotFoundError extends Error {
  constructor(requestId: string) {
    super(`Join request ${requestId} not found`);
    this.name = 'JoinRequestNotFoundError';
  }
}

// ---- Module 2.6: Match Creation & Game Room ----

export class MatchNotFoundError extends Error {
  constructor(matchId: string) {
    super(`Match ${matchId} not found`);
    this.name = 'MatchNotFoundError';
  }
}

export class MatchInvitationNotFoundError extends Error {
  constructor(invitationId: string) {
    super(`Match invitation ${invitationId} not found`);
    this.name = 'MatchInvitationNotFoundError';
  }
}

export class ReplacementNotFoundError extends Error {
  constructor(replacementId: string) {
    super(`Replacement ${replacementId} not found`);
    this.name = 'ReplacementNotFoundError';
  }
}

export class InvalidMatchStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMatchStateError';
  }
}

export class MatchAlreadyExistsForBookingError extends Error {
  constructor() {
    super('A match has already been created for this booking.');
    this.name = 'MatchAlreadyExistsForBookingError';
  }
}

export class InvalidCheckInCodeError extends Error {
  constructor() {
    super('This check-in code is invalid or has expired.');
    this.name = 'InvalidCheckInCodeError';
  }
}

// ---- Module 2.7: Countdown Intro ----

export class MatchIntroNotFoundError extends Error {
  constructor(matchId: string) {
    super(`No intro sequence has been started for match ${matchId}`);
    this.name = 'MatchIntroNotFoundError';
  }
}

// ---- Module 2.8: Live Scoring ----

export class InningsNotFoundError extends Error {
  constructor(inningsId: string) {
    super(`Innings ${inningsId} not found`);
    this.name = 'InningsNotFoundError';
  }
}

export class NoBallToUndoError extends Error {
  constructor() {
    super('There is no ball recorded yet to undo.');
    this.name = 'NoBallToUndoError';
  }
}

export class InvalidScoringStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScoringStateError';
  }
}

// ---- Module 2.10: Match Statistics & Basic Skill Rating ----

export class MatchNotCompletedError extends Error {
  constructor() {
    super('This match has not finished yet.');
    this.name = 'MatchNotCompletedError';
  }
}

// ---- Module 2.12: Turf Owner & Turf Staff ----

export class StaffAssignmentNotFoundError extends Error {
  constructor() {
    super('Staff assignment not found.');
    this.name = 'StaffAssignmentNotFoundError';
  }
}

// PRD §32.14: blocks Check-In and Payments actions until an owner approves
// the staff member's submitted document.
export class StaffNotVerifiedError extends Error {
  constructor() {
    super('Your staff account is still pending verification by the turf owner.');
    this.name = 'StaffNotVerifiedError';
  }
}

// ---- Module 2.13: Support ----

export class SupportTicketNotFoundError extends Error {
  constructor() {
    super('Support ticket not found.');
    this.name = 'SupportTicketNotFoundError';
  }
}

export class InvalidTicketStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move a support ticket from ${from} to ${to}.`);
    this.name = 'InvalidTicketStatusTransitionError';
  }
}

// PRD §32.9: the injury report flow is tied to the liability waiver
// captured during onboarding — this fires only if that was somehow never
// stamped (e.g. an account created before module 2.13, or a data issue),
// since createUserAccount now stamps it for every new registration.
export class WaiverNotAcceptedError extends Error {
  constructor() {
    super('You need to accept the liability waiver before filing an injury report.');
    this.name = 'WaiverNotAcceptedError';
  }
}

// ---- Backlog B-1: Promo Codes & BFAM Coins ----

export class PromoCodeNotFoundError extends Error {
  constructor() {
    super('That promo code was not found.');
    this.name = 'PromoCodeNotFoundError';
  }
}

export class PromoCodeNotApplicableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoCodeNotApplicableError';
  }
}

export class InsufficientCoinBalanceError extends Error {
  constructor() {
    super("You don't have enough BFAM Coins for that.");
    this.name = 'InsufficientCoinBalanceError';
  }
}

// ---- Backlog B-4: Reviews ----

export class ReviewAlreadySubmittedError extends Error {
  constructor() {
    super('You have already reviewed this match.');
    this.name = 'ReviewAlreadySubmittedError';
  }
}

export class MatchNotYetCompletedError extends Error {
  constructor() {
    super('You can only review a match after it has finished.');
    this.name = 'MatchNotYetCompletedError';
  }
}

// ---- Backlog B-9: Follows ----

export class CannotFollowSelfError extends Error {
  constructor() {
    super("You can't follow yourself.");
    this.name = 'CannotFollowSelfError';
  }
}

// ---- Backlog B-8: Rating-Gated Team Vacancies ----

export class SkillRatingTooLowError extends Error {
  constructor(minSkillRating: number) {
    super(`This team requires a Basic Skill Rating of at least ${minSkillRating} to join.`);
    this.name = 'SkillRatingTooLowError';
  }
}

// ---- Backlog B-6: Home Page Carousel / Admin CMS ----

export class BannerNotFoundError extends Error {
  constructor() {
    super('That banner was not found.');
    this.name = 'BannerNotFoundError';
  }
}

// ---- Backlog B-11: Pre-Match Room (lobby) ----

export class RoomNotFoundError extends Error {
  constructor(roomId: string) {
    super(`Room ${roomId} not found`);
    this.name = 'RoomNotFoundError';
  }
}

export class InvalidRoomStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoomStateError';
  }
}

export class AlreadyInRoomError extends Error {
  constructor() {
    super('This player is already in this room.');
    this.name = 'AlreadyInRoomError';
  }
}

export class RoomFullError extends Error {
  constructor() {
    super('This room is already full.');
    this.name = 'RoomFullError';
  }
}
