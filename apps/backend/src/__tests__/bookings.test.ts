// Exercises POST /bookings, GET /bookings/mine, GET /bookings/:id, and
// POST /bookings/:id/cancel through the real Express app via supertest.
// Only `sequelize` is faked; see turfs.test.ts for the same SQL-text
// pattern-matching approach.

const TURF_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OWNER_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const PLAYER_ID = 'cccccccc-0000-4000-8000-000000000003';
const OTHER_PLAYER_ID = 'dddddddd-0000-4000-8000-000000000004';

interface BookingRow {
  booking_id: string;
  turf_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  booking_amount: number;
  booking_status: string;
  payment_mode: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: Date;
  updated_at: Date;
}

let turfs: Array<{ turf_id: string; owner_id: string; turf_status: string }> = [];
let operatingHours: Array<{
  turf_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
}> = [];
let pricing: Array<{
  turf_id: string;
  day_type: string;
  start_time: string;
  end_time: string;
  price_per_hour: number;
  effective_from: string;
  effective_to: string | null;
}> = [];
let bookingsState: BookingRow[] = [];
let blocksState: Array<{ turf_id: string; start_datetime: string; end_datetime: string }> = [];
let auditLogs: Array<Record<string, unknown>> = [];

function activeSlotKey(b: {
  turf_id: string;
  booking_date: string;
  start_time: string;
  booking_status: string;
}) {
  return ['PENDING', 'CONFIRMED'].includes(b.booking_status)
    ? `${b.turf_id}:${b.booking_date}:${b.start_time}`
    : null;
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('SELECT owner_id FROM turfs')) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          return t ? [{ owner_id: t.owner_id }] : [];
        }

        if (sql.includes('FROM turfs WHERE turf_id')) {
          const t = turfs.find((x) => x.turf_id === r.turfId && x.turf_status === 'ACTIVE');
          return t ? [t] : [];
        }

        if (sql.includes('FROM turf_operating_hours')) {
          return operatingHours.filter(
            (h) => h.turf_id === r.turfId && h.day_of_week === r.dayOfWeek,
          );
        }

        if (sql.includes('FROM turf_availability_blocks')) {
          const start = (r.dayStart ?? r.slotStart) as string;
          const end = (r.dayEnd ?? r.slotEnd) as string;
          return blocksState.filter(
            (b) => b.turf_id === r.turfId && b.start_datetime < end && b.end_datetime > start,
          );
        }

        if (sql.includes('FROM turf_pricing')) {
          const date = (r.date ?? r.bookingDate) as string;
          return pricing
            .filter(
              (p) =>
                p.turf_id === r.turfId &&
                p.day_type === r.dayType &&
                p.start_time <= (r.startTime as string) &&
                p.end_time > (r.startTime as string) &&
                p.effective_from <= date &&
                (p.effective_to === null || p.effective_to >= date),
            )
            .slice(0, 1);
        }

        if (sql.includes('FROM bookings WHERE booking_id')) {
          const b = bookingsState.find((x) => x.booking_id === r.bookingId);
          return b ? [b] : [];
        }

        if (sql.includes('FROM bookings b JOIN turfs t')) {
          return bookingsState
            .filter((b) => b.booked_by === r.userId)
            .map((b) => ({ ...b, turf_name: 'Green Park Box Cricket', city: 'Rajkot' }));
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'bookings') {
            for (const row of rows) {
              const candidate = row as unknown as BookingRow;
              const key = activeSlotKey(candidate);
              const clash = key && bookingsState.some((b) => activeSlotKey(b) === key);
              if (clash) {
                const err = new Error(
                  "ER_DUP_ENTRY: Duplicate entry for key 'bookings.active_booking_slot_key'",
                );
                err.name = 'SequelizeUniqueConstraintError';
                throw err;
              }
              bookingsState.push(candidate);
            }
            return;
          }
          if (table === 'audit_logs') {
            auditLogs.push(...rows);
            return;
          }
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'bookings') {
            const idx = bookingsState.findIndex((b) => b.booking_id === where.booking_id);
            if (idx >= 0) bookingsState[idx] = { ...bookingsState[idx], ...values } as BookingRow;
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(role: 'PLAYER' | 'TURF_OWNER' | 'ADMIN', userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Turf Booking (module 2.3)', () => {
  const DATE = '2026-09-10'; // a Thursday
  let dayOfWeek: number;

  beforeEach(() => {
    dayOfWeek = new Date(`${DATE}T00:00:00Z`).getUTCDay();
    turfs = [{ turf_id: TURF_ID, owner_id: OWNER_ID, turf_status: 'ACTIVE' }];
    operatingHours = [
      { turf_id: TURF_ID, day_of_week: dayOfWeek, open_time: '18:00:00', close_time: '22:00:00' },
    ];
    pricing = [
      {
        turf_id: TURF_ID,
        day_type: 'WEEKDAY',
        start_time: '18:00:00',
        end_time: '22:00:00',
        price_per_hour: 1000,
        effective_from: '2026-01-01',
        effective_to: null,
      },
    ];
    bookingsState = [];
    blocksState = [];
    auditLogs = [];
  });

  describe('POST /bookings', () => {
    it('creates a PENDING booking with the amount computed from turf_pricing', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      expect(res.status).toBe(201);
      expect(res.body.booking_status).toBe('PENDING');
      expect(res.body.booking_amount).toBe(1000);
      expect(bookingsState).toHaveLength(1);
    });

    it('rejects a booking outside operating hours with a clean 422, not a raw DB error', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '05:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/operating hours/i);
    });

    it('rejects a booking inside an owner-blocked window', async () => {
      blocksState = [
        { turf_id: TURF_ID, start_datetime: `${DATE} 18:00:00`, end_datetime: `${DATE} 19:00:00` },
      ];
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '18:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/blocked/i);
    });

    it('returns a clean "slot no longer available" response on a duplicate active booking, not a raw DB error', async () => {
      bookingsState = [
        {
          booking_id: 'existing-1',
          turf_id: TURF_ID,
          booked_by: OTHER_PLAYER_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          end_time: '20:00:00',
          duration_minutes: 60,
          booking_amount: 1000,
          booking_status: 'CONFIRMED',
          payment_mode: 'UPI',
          cancellation_reason: null,
          cancelled_at: null,
          cancelled_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        'This slot is no longer available. Please choose another time.',
      );
      expect(res.body.error.message).not.toMatch(
        /ER_DUP_ENTRY|SequelizeUniqueConstraintError|SQL/i,
      );
    });

    it('rejects a non-PLAYER caller', async () => {
      const token = await tokenFor('TURF_OWNER', OWNER_ID);
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });
      expect(res.status).toBe(403);
    });

    it('rejects an invalid payload', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: 'not-a-uuid',
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /bookings/mine and GET /bookings/:bookingId', () => {
    it("lists only the caller's own bookings", async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      await request(app).post('/bookings').set('Authorization', `Bearer ${token}`).send({
        turf_id: TURF_ID,
        booking_date: DATE,
        start_time: '19:00:00',
        duration_minutes: 60,
        payment_mode: 'UPI',
      });

      const otherToken = await tokenFor('PLAYER', OTHER_PLAYER_ID);
      await request(app).post('/bookings').set('Authorization', `Bearer ${otherToken}`).send({
        turf_id: TURF_ID,
        booking_date: DATE,
        start_time: '20:00:00',
        duration_minutes: 60,
        payment_mode: 'UPI',
      });

      const res = await request(app).get('/bookings/mine').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].booked_by).toBe(PLAYER_ID);
    });

    it('lets the booker view booking details but forbids an unrelated player', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const created = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      const ownDetails = await request(app)
        .get(`/bookings/${created.body.booking_id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(ownDetails.status).toBe(200);

      const otherToken = await tokenFor('PLAYER', OTHER_PLAYER_ID);
      const forbidden = await request(app)
        .get(`/bookings/${created.body.booking_id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(forbidden.status).toBe(403);
    });

    it('returns 404 for an unknown booking', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const res = await request(app)
        .get('/bookings/00000000-0000-4000-8000-000000000099')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /bookings/:bookingId/cancel', () => {
    it("cancels the booker's own booking and writes an audit log entry", async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const created = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      const res = await request(app)
        .post(`/bookings/${created.body.booking_id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ cancellation_reason: 'Rained out' });

      expect(res.status).toBe(200);
      expect(res.body.booking_status).toBe('CANCELLED');
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('BOOKING_CANCELLED');
      expect(auditLogs[0].resource_id).toBe(created.body.booking_id);
    });

    it('allows the turf owner to cancel a booking on their own turf', async () => {
      const playerToken = await tokenFor('PLAYER', PLAYER_ID);
      const created = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      const ownerToken = await tokenFor('TURF_OWNER', OWNER_ID);
      const res = await request(app)
        .post(`/bookings/${created.body.booking_id}/cancel`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.booking_status).toBe('CANCELLED');
    });

    it("forbids an unrelated player from cancelling someone else's booking", async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const created = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      const otherToken = await tokenFor('PLAYER', OTHER_PLAYER_ID);
      const res = await request(app)
        .post(`/bookings/${created.body.booking_id}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('rejects cancelling an already-cancelled booking', async () => {
      const token = await tokenFor('PLAYER', PLAYER_ID);
      const created = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          turf_id: TURF_ID,
          booking_date: DATE,
          start_time: '19:00:00',
          duration_minutes: 60,
          payment_mode: 'UPI',
        });

      await request(app)
        .post(`/bookings/${created.body.booking_id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      const res = await request(app)
        .post(`/bookings/${created.body.booking_id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(409);
    });
  });
});
