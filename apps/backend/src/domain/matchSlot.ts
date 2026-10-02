import { InvalidMatchStateError } from './errors';
import { bookingStartInstant } from './time';

// A booked turf slot (say 18:00-20:00) can hold several matches, each with its own
// start and end, as long as they do not overlap and stay inside the slot. This is
// the pure rule for working out where a new match goes; the caller supplies the
// slot and the matches already in it.

export interface SlotInput {
  booking_date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM' or 'HH:MM:SS'
  end_time: string;
}

export interface ExistingMatchWindow {
  scheduled_start_time: Date | string;
  // Matches made before slots could be split have no end: they filled the slot.
  scheduled_end_time: Date | string | null;
}

export interface RequestedWindow {
  start_time?: string | null; // 'HH:MM' (India time)
  end_time?: string | null;
}

export const MIN_MATCH_MINUTES = 15;
const IST_OFFSET_MS = 330 * 60_000;

export function formatIst(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

function parseTime(value: string): string {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new InvalidMatchStateError('Times must look like 18:30.');
  }
  return value;
}

export function resolveMatchWindow(
  slot: SlotInput,
  existing: ExistingMatchWindow[],
  requested: RequestedWindow = {},
): { start: Date; end: Date } {
  const slotStart = bookingStartInstant(slot.booking_date, slot.start_time);
  const slotEnd = bookingStartInstant(slot.booking_date, slot.end_time);

  const occupied = existing
    .map((m) => ({
      start: new Date(m.scheduled_start_time),
      end: m.scheduled_end_time ? new Date(m.scheduled_end_time) : slotEnd,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Where the next free time begins: right after the last match, or the start of the slot.
  const nextFree = occupied.reduce(
    (latest, o) => (o.end.getTime() > latest.getTime() ? o.end : latest),
    slotStart,
  );

  const start = requested.start_time
    ? bookingStartInstant(slot.booking_date, parseTime(requested.start_time))
    : nextFree;

  if (!requested.start_time && occupied.length > 0 && start.getTime() >= slotEnd.getTime()) {
    throw new InvalidMatchStateError(
      'This slot is already full. Book another slot to play more matches.',
    );
  }

  // Without an explicit end, run until the next match begins or the slot ends.
  const nextStart = occupied.find((o) => o.start.getTime() >= start.getTime());
  const end = requested.end_time
    ? bookingStartInstant(slot.booking_date, parseTime(requested.end_time))
    : nextStart && nextStart.start.getTime() < slotEnd.getTime()
      ? nextStart.start
      : slotEnd;

  if (start.getTime() < slotStart.getTime() || end.getTime() > slotEnd.getTime()) {
    throw new InvalidMatchStateError(
      `A match must fall inside the booked slot (${formatIst(slotStart)}-${formatIst(slotEnd)}).`,
    );
  }
  if (end.getTime() - start.getTime() < MIN_MATCH_MINUTES * 60_000) {
    throw new InvalidMatchStateError(
      `A match needs at least ${MIN_MATCH_MINUTES} minutes in the slot.`,
    );
  }

  const clash = occupied.find(
    (o) => start.getTime() < o.end.getTime() && o.start.getTime() < end.getTime(),
  );
  if (clash) {
    throw new InvalidMatchStateError(
      `That time overlaps another match in this slot (${formatIst(clash.start)}-${formatIst(clash.end)}).`,
    );
  }

  return { start, end };
}
