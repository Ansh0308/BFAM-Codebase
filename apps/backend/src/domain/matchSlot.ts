import { InvalidMatchStateError } from './errors';
import { bookingStartInstant } from './time';

// A booked turf slot (say 6-8 PM) usually holds more than one match. Players cannot know
// in advance when a match will end, so matches are NOT given a time window up front:
// they run one after another. A new match can be created in a slot while the slot is
// still running (or has not started) and every earlier match in it is finished
// (COMPLETED) or CANCELLED. What a match actually took is recorded when it starts and
// when it finishes (matches.actual_start_time / actual_end_time).

export interface SlotInput {
  booking_date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM' or 'HH:MM:SS'
  end_time: string;
}

export type SlotState = 'UPCOMING' | 'ACTIVE' | 'PASSED';

export interface SlotAssessment {
  slot_state: SlotState;
  can_add_match: boolean;
  // Why a match cannot be added (null when it can).
  reason: string | null;
}

const FINISHED = new Set(['COMPLETED', 'CANCELLED']);

export const SLOT_PASSED_MESSAGE = 'This slot has ended. Book a new slot to play more matches.';
export const MATCH_STILL_RUNNING_MESSAGE =
  'Finish the current match in this slot before creating the next one.';

export function slotWindow(slot: SlotInput): { start: Date; end: Date } {
  return {
    start: bookingStartInstant(slot.booking_date, slot.start_time),
    end: bookingStartInstant(slot.booking_date, slot.end_time),
  };
}

export function assessSlot(
  slot: SlotInput,
  matches: { match_status: string }[],
  now: Date = new Date(),
): SlotAssessment {
  const { start, end } = slotWindow(slot);
  const slotState: SlotState =
    now.getTime() >= end.getTime()
      ? 'PASSED'
      : now.getTime() >= start.getTime()
        ? 'ACTIVE'
        : 'UPCOMING';

  if (slotState === 'PASSED') {
    return { slot_state: slotState, can_add_match: false, reason: SLOT_PASSED_MESSAGE };
  }
  if (matches.some((m) => !FINISHED.has(m.match_status))) {
    return { slot_state: slotState, can_add_match: false, reason: MATCH_STILL_RUNNING_MESSAGE };
  }
  return { slot_state: slotState, can_add_match: true, reason: null };
}

export function assertSlotAcceptsNewMatch(
  slot: SlotInput,
  matches: { match_status: string }[],
  now: Date = new Date(),
): void {
  const assessment = assessSlot(slot, matches, now);
  if (!assessment.can_add_match) throw new InvalidMatchStateError(assessment.reason as string);
}

// When the match is scheduled to begin: the first one at the slot's start; one created
// later, once the earlier matches are done, starts as soon as it is created (never before
// the slot itself begins).
export function scheduledStartFor(
  slot: SlotInput,
  existingMatchCount: number,
  now: Date = new Date(),
): Date {
  const { start } = slotWindow(slot);
  return existingMatchCount === 0 || now.getTime() < start.getTime() ? start : now;
}
