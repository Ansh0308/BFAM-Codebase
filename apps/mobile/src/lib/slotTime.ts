// Helpers for a booked slot that holds several matches. The server sends match times as
// instants; players think in India time, as the slot itself is stored.
const IST_OFFSET_MS = 330 * 60_000;

// Instant -> 'HH:MM' in India time.
export function istHHMM(instant: string | Date): string {
  return new Date(new Date(instant).getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

export type SlotState = 'UPCOMING' | 'ACTIVE' | 'PASSED';

interface SlotLike {
  booking_date: string; // 'YYYY-MM-DD'
  start_time: string; // 'HH:MM' or 'HH:MM:SS'
  end_time: string;
}

function instant(date: string, time: string): number {
  const t = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return new Date(`${date}T${t}+05:30`).getTime();
}

// Upcoming / running now / ended. Mirrors the server's rule (backend domain/matchSlot.ts),
// which stays the authority on whether a match can actually be created.
export function slotState(slot: SlotLike, now: Date = new Date()): SlotState {
  if (now.getTime() >= instant(slot.booking_date, slot.end_time)) return 'PASSED';
  if (now.getTime() >= instant(slot.booking_date, slot.start_time)) return 'ACTIVE';
  return 'UPCOMING';
}
