// BFAM is an India product: a turf booking's date and start time are
// wall-clock times in India (IST, UTC+05:30, no daylight saving), stored as a
// plain DATE and TIME with no zone. Turning them into an instant must
// therefore always say "IST" explicitly. Building `new Date("2026-09-26T18:00")`
// instead uses the SERVER's timezone: fine on a developer's Indian laptop,
// but a UTC cloud host then reads 18:00 as 18:00 UTC — a match that starts
// 5½ hours late, with reminders and refund windows to match.
const IST_OFFSET = '+05:30';
const IST_OFFSET_MINUTES = 330;

// booking_date is 'YYYY-MM-DD'; start_time is 'HH:MM' or 'HH:MM:SS'.
export function bookingStartInstant(bookingDate: string, startTime: string): Date {
  const time = /^\d{2}:\d{2}$/.test(startTime) ? `${startTime}:00` : startTime;
  return new Date(`${bookingDate}T${time}${IST_OFFSET}`);
}

// Today's calendar date in India, as 'YYYY-MM-DD'.
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

// The same thing as a SQL expression. MySQL's CURDATE() follows the DB
// server's timezone (UTC on Azure/Railway), so "upcoming" vs "past" bookings
// and "is this price still current" would flip at 05:30 IST instead of at
// midnight. UTC_TIMESTAMP() is independent of the server's zone.
export const IST_TODAY_SQL = `DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${IST_OFFSET_MINUTES} MINUTE))`;
