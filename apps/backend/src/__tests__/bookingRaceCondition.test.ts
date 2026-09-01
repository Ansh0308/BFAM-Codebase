// PRD §15 requires that a turf slot can never be double-booked, enforced at
// the DB level (Phase 1's composite unique constraint on
// (turf_id, booking_date, start_time), backed by the `active_booking_slot_key`
// generated column — see migrations/20260827010000-phase1-backend-foundation.ts).
// This test fires many concurrent POST /bookings requests for the exact same
// slot and asserts exactly one succeeds and every other request gets the
// clean 409 "slot no longer available" response, never a raw DB error.

const TURF_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OWNER_ID = 'bbbbbbbb-0000-4000-8000-000000000002';

interface BookingRow {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  booking_status: string;
  [key: string]: unknown;
}

let bookingsState: BookingRow[] = [];

function activeSlotKey(b: BookingRow) {
  return ['PENDING', 'CONFIRMED'].includes(b.booking_status)
    ? `${b.turf_id}:${b.booking_date}:${b.start_time}`
    : null;
}

const TURF = { turf_id: TURF_ID, owner_id: OWNER_ID, turf_status: 'ACTIVE' };
const DATE = '2026-09-12';
const DAY_OF_WEEK = new Date(`${DATE}T00:00:00Z`).getUTCDay();
const HOURS = {
  turf_id: TURF_ID,
  day_of_week: DAY_OF_WEEK,
  open_time: '18:00:00',
  close_time: '22:00:00',
};
const PRICING = {
  turf_id: TURF_ID,
  day_type: DAY_OF_WEEK === 0 || DAY_OF_WEEK === 6 ? 'WEEKEND' : 'WEEKDAY',
  start_time: '18:00:00',
  end_time: '22:00:00',
  price_per_hour: 1000,
  effective_from: '2026-01-01',
  effective_to: null as string | null,
};

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('FROM turfs WHERE turf_id')) {
          return r.turfId === TURF_ID ? [TURF] : [];
        }
        if (sql.includes('FROM turf_operating_hours')) {
          return r.turfId === TURF_ID && r.dayOfWeek === DAY_OF_WEEK ? [HOURS] : [];
        }
        if (sql.includes('FROM turf_availability_blocks')) {
          return [];
        }
        if (sql.includes('FROM turf_pricing')) {
          return r.turfId === TURF_ID ? [PRICING] : [];
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: BookingRow[]) => {
          if (table !== 'bookings') return;
          for (const row of rows) {
            const key = activeSlotKey(row);
            if (key && bookingsState.some((b) => activeSlotKey(b) === key)) {
              const err = new Error(
                "ER_DUP_ENTRY: Duplicate entry for key 'bookings.active_booking_slot_key'",
              );
              err.name = 'SequelizeUniqueConstraintError';
              throw err;
            }
            bookingsState.push(row);
          }
        },
        bulkUpdate: async () => undefined,
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function playerToken(userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER', user_id: userId });
  return res.body.token as string;
}

describe('No-double-booking under concurrency (PRD §15)', () => {
  beforeEach(() => {
    bookingsState = [];
  });

  it('fires two simultaneous booking requests for the same slot and lets exactly one succeed', async () => {
    const [tokenA, tokenB] = await Promise.all([playerToken('player-a'), playerToken('player-b')]);

    const payload = {
      turf_id: TURF_ID,
      booking_date: DATE,
      start_time: '19:00:00',
      duration_minutes: 60,
      payment_mode: 'UPI',
    };

    const [resA, resB] = await Promise.all([
      request(app).post('/bookings').set('Authorization', `Bearer ${tokenA}`).send(payload),
      request(app).post('/bookings').set('Authorization', `Bearer ${tokenB}`).send(payload),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = resA.status === 409 ? resA : resB;
    expect(failed.body.error.message).toBe(
      'This slot is no longer available. Please choose another time.',
    );
    expect(failed.body.error.message).not.toMatch(/ER_DUP_ENTRY|SequelizeUniqueConstraintError/i);

    expect(bookingsState).toHaveLength(1);
  });

  it('lets exactly one of many concurrent requests for the same slot succeed', async () => {
    const tokens = await Promise.all(
      Array.from({ length: 10 }, (_, i) => playerToken(`concurrent-player-${i}`)),
    );

    const payload = {
      turf_id: TURF_ID,
      booking_date: DATE,
      start_time: '20:00:00',
      duration_minutes: 60,
      payment_mode: 'UPI',
    };

    const responses = await Promise.all(
      tokens.map((token) =>
        request(app).post('/bookings').set('Authorization', `Bearer ${token}`).send(payload),
      ),
    );

    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(tokens.length - 1);
    expect(bookingsState).toHaveLength(1);
  });

  it('allows booking a different slot on the same turf/date after the first is taken', async () => {
    const [tokenA, tokenB] = await Promise.all([playerToken('player-a'), playerToken('player-b')]);

    const first = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        turf_id: TURF_ID,
        booking_date: DATE,
        start_time: '18:00:00',
        duration_minutes: 60,
        payment_mode: 'UPI',
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        turf_id: TURF_ID,
        booking_date: DATE,
        start_time: '19:00:00',
        duration_minutes: 60,
        payment_mode: 'UPI',
      });
    expect(second.status).toBe(201);

    expect(bookingsState).toHaveLength(2);
  });
});
