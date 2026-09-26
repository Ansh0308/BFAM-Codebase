// Booking dates/times are India wall-clock time. Building them into an instant
// must not depend on the timezone of the machine running the backend (a UTC
// cloud host used to shift every match and refund window by 5½ hours).

import { IST_TODAY_SQL, bookingStartInstant, istToday } from '../domain/time';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('bookingStartInstant', () => {
  it.each(['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland'])(
    'is the same instant when the server runs in %s',
    (tz) => {
      process.env.TZ = tz;
      // 18:00 in India is 12:30 UTC.
      expect(bookingStartInstant('2026-09-26', '18:00:00').toISOString()).toBe(
        '2026-09-26T12:30:00.000Z',
      );
    },
  );

  it('accepts HH:MM as well as HH:MM:SS', () => {
    expect(bookingStartInstant('2026-09-26', '18:00').toISOString()).toBe(
      '2026-09-26T12:30:00.000Z',
    );
  });

  it('crosses midnight correctly (00:30 IST is the previous day in UTC)', () => {
    expect(bookingStartInstant('2026-09-26', '00:30:00').toISOString()).toBe(
      '2026-09-25T19:00:00.000Z',
    );
  });
});

describe('istToday', () => {
  it('is the Indian calendar date, not the UTC one', () => {
    // 20:00 UTC on the 25th is already 01:30 on the 26th in India.
    expect(istToday(new Date('2026-09-25T20:00:00Z'))).toBe('2026-09-26');
    // 18:00 UTC is 23:30 IST the same day.
    expect(istToday(new Date('2026-09-25T18:00:00Z'))).toBe('2026-09-25');
  });

  it.each(['UTC', 'America/New_York'])('does not depend on the server timezone (%s)', (tz) => {
    process.env.TZ = tz;
    expect(istToday(new Date('2026-09-25T20:00:00Z'))).toBe('2026-09-26');
  });
});

describe('IST_TODAY_SQL', () => {
  it('uses UTC_TIMESTAMP (independent of the DB server zone) shifted by 330 minutes', () => {
    expect(IST_TODAY_SQL).toContain('UTC_TIMESTAMP()');
    expect(IST_TODAY_SQL).toContain('INTERVAL 330 MINUTE');
    expect(IST_TODAY_SQL).not.toContain('CURDATE');
  });
});
