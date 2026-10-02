// Time arithmetic for a booked slot that holds several matches. The server sends match
// times as instants; players think in India time, as the slot itself is stored.
const IST_OFFSET_MS = 330 * 60_000;

// Instant -> 'HH:MM' in India time.
export function istHHMM(instant: string | Date): string {
  return new Date(new Date(instant).getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const MIN_MATCH_MINUTES = 15;

export interface SlotMatchTimes {
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  match_status?: string;
}

// The unbooked stretches of the slot as 'HH:MM' pairs, earliest first. Cancelled matches
// free their time; a match from before slots could be split (no end) fills it to the end.
export function freeWindows(
  slotStart: string,
  slotEnd: string,
  matches: SlotMatchTimes[],
): { from: string; to: string }[] {
  const start = toMinutes(slotStart.slice(0, 5));
  const end = toMinutes(slotEnd.slice(0, 5));
  const busy = matches
    .filter((m) => m.match_status !== 'CANCELLED')
    .map((m) => ({
      from: toMinutes(istHHMM(m.scheduled_start_time)),
      to: m.scheduled_end_time ? toMinutes(istHHMM(m.scheduled_end_time)) : end,
    }))
    .sort((a, b) => a.from - b.from);

  const windows: { from: string; to: string }[] = [];
  let cursor = start;
  for (const b of busy) {
    if (b.from - cursor >= MIN_MATCH_MINUTES) {
      windows.push({ from: fromMinutes(cursor), to: fromMinutes(b.from) });
    }
    cursor = Math.max(cursor, b.to);
  }
  if (end - cursor >= MIN_MATCH_MINUTES) {
    windows.push({ from: fromMinutes(cursor), to: fromMinutes(end) });
  }
  return windows;
}
