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
