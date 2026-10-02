import {
  assertSlotAcceptsNewMatch,
  assessSlot,
  scheduledStartFor,
  MATCH_STILL_RUNNING_MESSAGE,
  SLOT_PASSED_MESSAGE,
} from '../domain/matchSlot';
import { bookingStartInstant } from '../domain/time';

// Slot 6-8 PM India time on 2026-10-10.
const SLOT = { booking_date: '2026-10-10', start_time: '18:00:00', end_time: '20:00:00' };
const at = (hhmm: string) => bookingStartInstant(SLOT.booking_date, hhmm);
const m = (match_status: string) => ({ match_status });

describe('assessSlot', () => {
  it('lets the first match be created before the slot starts', () => {
    expect(assessSlot(SLOT, [], at('17:00'))).toEqual({
      slot_state: 'UPCOMING',
      can_add_match: true,
      reason: null,
    });
  });

  it('lets a match be created while the slot is running', () => {
    expect(assessSlot(SLOT, [], at('18:30'))).toMatchObject({
      slot_state: 'ACTIVE',
      can_add_match: true,
    });
  });

  it('allows the next match once every earlier match is finished or cancelled', () => {
    const a = assessSlot(SLOT, [m('COMPLETED'), m('CANCELLED')], at('19:00'));
    expect(a).toMatchObject({ slot_state: 'ACTIVE', can_add_match: true });
  });

  it.each(['OPEN', 'PENDING', 'CONFIRMED', 'IN_PROGRESS'])(
    'does not allow another match while one is %s',
    (status) => {
      const a = assessSlot(SLOT, [m('COMPLETED'), m(status)], at('19:00'));
      expect(a.can_add_match).toBe(false);
      expect(a.reason).toBe(MATCH_STILL_RUNNING_MESSAGE);
    },
  );

  it('does not allow a match once the slot has ended, even if all matches are done', () => {
    const a = assessSlot(SLOT, [m('COMPLETED')], at('20:00'));
    expect(a).toEqual({ slot_state: 'PASSED', can_add_match: false, reason: SLOT_PASSED_MESSAGE });
    expect(assessSlot(SLOT, [], at('21:30')).can_add_match).toBe(false);
  });
});

describe('assertSlotAcceptsNewMatch', () => {
  it('passes when a match can be added and explains why when not', () => {
    expect(() => assertSlotAcceptsNewMatch(SLOT, [], at('18:10'))).not.toThrow();
    expect(() => assertSlotAcceptsNewMatch(SLOT, [m('IN_PROGRESS')], at('18:10'))).toThrow(
      /Finish the current match/,
    );
    expect(() => assertSlotAcceptsNewMatch(SLOT, [], at('20:05'))).toThrow(/slot has ended/);
  });
});

describe('scheduledStartFor', () => {
  it('puts the first match at the start of the slot', () => {
    expect(scheduledStartFor(SLOT, 0, at('17:00')).getTime()).toBe(at('18:00').getTime());
    expect(scheduledStartFor(SLOT, 0, at('18:20')).getTime()).toBe(at('18:00').getTime());
  });

  it('starts a later match when it is created', () => {
    expect(scheduledStartFor(SLOT, 1, at('18:50')).getTime()).toBe(at('18:50').getTime());
  });
});
