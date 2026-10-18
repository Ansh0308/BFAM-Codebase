import { assertSlotOpenForStart, EARLY_START_GRACE_MINUTES } from '../domain/matchSlot';
import { InvalidMatchStateError } from '../domain/errors';

// "Match should not start when the turf is booked for a future date": a team booked a slot for
// another day and could still tap Start Match today. A match opens only shortly before its slot.

const slot = { booking_date: '2026-10-25', start_time: '18:00:00', end_time: '19:00:00' };
// 18:00 IST is 12:30 UTC.
const slotStart = new Date('2026-10-25T12:30:00Z').getTime();
const minute = 60_000;

describe('assertSlotOpenForStart', () => {
  it('refuses a booking for a later day', () => {
    const now = new Date(slotStart - 3 * 24 * 60 * minute);
    expect(() => assertSlotOpenForStart(slot, now)).toThrow(InvalidMatchStateError);
    expect(() => assertSlotOpenForStart(slot, now)).toThrow(/booked for .*25 Oct.*6:00/i);
  });

  it('refuses a start earlier than the head-start window', () => {
    const now = new Date(slotStart - (EARLY_START_GRACE_MINUTES + 1) * minute);
    expect(() => assertSlotOpenForStart(slot, now)).toThrow(/15 minutes before/);
  });

  it('allows a start inside the head-start window, at the slot time and while it runs', () => {
    expect(() =>
      assertSlotOpenForStart(slot, new Date(slotStart - EARLY_START_GRACE_MINUTES * minute)),
    ).not.toThrow();
    expect(() => assertSlotOpenForStart(slot, new Date(slotStart))).not.toThrow();
    expect(() => assertSlotOpenForStart(slot, new Date(slotStart + 30 * minute))).not.toThrow();
  });
});
