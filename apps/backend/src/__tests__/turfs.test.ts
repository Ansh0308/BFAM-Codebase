// Exercises GET /turfs, GET /turfs/:turfId, and GET /turfs/:turfId/availability
// through the real Express app via supertest. Only the low-level `sequelize`
// module is faked (no real MySQL in this test environment) — the fake
// pattern-matches on SQL text the same way registration.test.ts does.

interface TurfRow {
  turf_id: string;
  owner_id: string;
  turf_name: string;
  description: string | null;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  ball_types_supported: string;
  stadium_sound_enabled: boolean;
  turf_status: string;
  average_rating: number | null;
}

const TURF_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

let turfs: TurfRow[] = [];
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
let bookingsState: Array<{
  turf_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  booking_status: string;
}> = [];
let blocksState: Array<{ turf_id: string; start_datetime: string; end_datetime: string }> = [];
let images: Array<{ turf_id: string; image_url: string; display_order: number }> = [];
let facilities: Array<{ turf_id: string; facility_name: string }> = [];

function findPricing(turfId: string, dayType: string, startTime: string, date: string) {
  return pricing.filter(
    (p) =>
      p.turf_id === turfId &&
      p.day_type === dayType &&
      p.start_time <= startTime &&
      p.end_time > startTime &&
      p.effective_from <= date &&
      (p.effective_to === null || p.effective_to >= date),
  );
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('FROM turfs t')) {
          // Listing query — apply filters directly against in-memory state.
          let rows = turfs.filter((t) => t.turf_status === 'ACTIVE');
          if (r.city) rows = rows.filter((t) => t.city.includes(String(r.city).replace(/%/g, '')));
          if (r.q) {
            const needle = String(r.q).replace(/%/g, '');
            rows = rows.filter(
              (t) => t.turf_name.includes(needle) || t.address_line.includes(needle),
            );
          }
          if (r.ballType) {
            const wanted = JSON.parse(String(r.ballType));
            rows = rows.filter((t) => JSON.parse(t.ball_types_supported).includes(wanted));
          }
          return rows.map((t) => ({
            ...t,
            distance_km: null,
            cover_image_url: images.find((i) => i.turf_id === t.turf_id)?.image_url ?? null,
            min_price_per_hour: pricing
              .filter((p) => p.turf_id === t.turf_id)
              .reduce(
                (min, p) => (min === null ? p.price_per_hour : Math.min(min, p.price_per_hour)),
                null as number | null,
              ),
          }));
        }

        if (sql.includes('SELECT owner_id FROM turfs')) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          return t ? [{ owner_id: t.owner_id }] : [];
        }

        if (sql.includes('FROM turfs WHERE turf_id')) {
          const t = turfs.find((x) => x.turf_id === r.turfId && x.turf_status === 'ACTIVE');
          return t ? [t] : [];
        }

        if (sql.includes('FROM turf_images')) {
          return images
            .filter((i) => i.turf_id === r.turfId)
            .sort((a, b) => a.display_order - b.display_order);
        }

        if (sql.includes('FROM turf_facilities')) {
          return facilities.filter((f) => f.turf_id === r.turfId);
        }

        if (sql.includes('FROM turf_operating_hours')) {
          if (r.dayOfWeek !== undefined) {
            return operatingHours.filter(
              (h) => h.turf_id === r.turfId && h.day_of_week === r.dayOfWeek,
            );
          }
          return operatingHours.filter((h) => h.turf_id === r.turfId);
        }

        if (sql.includes('FROM turf_pricing')) {
          if (r.dayType !== undefined) {
            const date = (r.date ?? r.bookingDate) as string;
            return findPricing(
              String(r.turfId),
              String(r.dayType),
              String(r.startTime),
              date,
            ).slice(0, 1);
          }
          return pricing.filter((p) => p.turf_id === r.turfId);
        }

        if (
          sql.includes('FROM bookings') &&
          sql.includes("booking_status IN ('PENDING','CONFIRMED')")
        ) {
          return bookingsState.filter((b) => b.turf_id === r.turfId && b.booking_date === r.date);
        }

        if (sql.includes('FROM turf_availability_blocks')) {
          // Real turf_availability_blocks rows come back from mysql2 as Date
          // objects (not strings), so getTurfAvailability's own
          // `new Date(...)` overlap math is what actually narrows blocks to
          // specific slots — this fake only needs to match on turf_id and
          // hand back fixtures as unambiguous UTC ISO strings (see
          // blocksState below) so that downstream `new Date()` parsing is
          // deterministic regardless of the host machine's timezone.
          return blocksState.filter((b) => b.turf_id === r.turfId);
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async () => undefined,
        bulkUpdate: async () => undefined,
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function playerToken() {
  const res = await request(app).post('/auth/dev-token').send({ role: 'PLAYER' });
  return res.body.token as string;
}

describe('Turf Discovery (module 2.3)', () => {
  beforeEach(() => {
    turfs = [
      {
        turf_id: TURF_ID,
        owner_id: 'owner-1',
        turf_name: 'Green Park Box Cricket',
        description: 'Covered turf',
        address_line: 'Ring Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
        ball_types_supported: JSON.stringify(['TENNIS', 'HARD_TENNIS']),
        stadium_sound_enabled: true,
        turf_status: 'ACTIVE',
        average_rating: 4.3,
      },
    ];
    operatingHours = [];
    pricing = [];
    bookingsState = [];
    blocksState = [];
    images = [{ turf_id: TURF_ID, image_url: 'https://cdn.bfam.app/1.jpg', display_order: 1 }];
    facilities = [{ turf_id: TURF_ID, facility_name: 'FLOODLIGHTS' }];
  });

  describe('GET /turfs', () => {
    it('lists active turfs and supports search/filter query params', async () => {
      const token = await playerToken();
      const res = await request(app)
        .get('/turfs')
        .query({ city: 'Rajkot', q: 'Green' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].turf_name).toBe('Green Park Box Cricket');
    });

    it('excludes turfs that do not match the filter', async () => {
      const token = await playerToken();
      const res = await request(app)
        .get('/turfs')
        .query({ q: 'Nonexistent Turf Name' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(0);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/turfs');
      expect(res.status).toBe(401);
    });

    it('rejects an invalid filter payload', async () => {
      const token = await playerToken();
      const res = await request(app)
        .get('/turfs')
        .query({ min_price: 'not-a-number' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /turfs/:turfId', () => {
    it('returns gallery, facilities, pricing, and an availability preview', async () => {
      const dateStr = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      operatingHours = [
        { turf_id: TURF_ID, day_of_week: dayOfWeek, open_time: '06:00:00', close_time: '10:00:00' },
      ];

      const token = await playerToken();
      const res = await request(app)
        .get(`/turfs/${TURF_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.turf_id).toBe(TURF_ID);
      expect(res.body.images).toHaveLength(1);
      expect(res.body.facilities).toHaveLength(1);
      expect(res.body.availability_preview).not.toBeNull();
      expect(Array.isArray(res.body.availability_preview.slots)).toBe(true);
    });

    it('returns 404 for an unknown turf', async () => {
      const token = await playerToken();
      const res = await request(app)
        .get('/turfs/00000000-0000-4000-8000-000000000099')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /turfs/:turfId/availability', () => {
    it('marks a slot with an active booking as BOOKED and distinguishes it from AVAILABLE', async () => {
      const dateStr = '2026-09-05';
      const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      operatingHours = [
        { turf_id: TURF_ID, day_of_week: dayOfWeek, open_time: '18:00:00', close_time: '21:00:00' },
      ];
      bookingsState = [
        {
          turf_id: TURF_ID,
          booking_date: dateStr,
          start_time: '19:00:00',
          duration_minutes: 60,
          booking_status: 'CONFIRMED',
        },
      ];

      const token = await playerToken();
      const res = await request(app)
        .get(`/turfs/${TURF_ID}/availability`)
        .query({ date: dateStr })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const slotMap = Object.fromEntries(
        res.body.slots.map((s: { start_time: string; status: string }) => [s.start_time, s.status]),
      );
      expect(slotMap['18:00:00']).toBe('AVAILABLE');
      expect(slotMap['19:00:00']).toBe('BOOKED');
      expect(slotMap['20:00:00']).toBe('AVAILABLE');
    });

    it('marks a slot inside an owner block as BLOCKED', async () => {
      const dateStr = '2026-09-06';
      const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      operatingHours = [
        { turf_id: TURF_ID, day_of_week: dayOfWeek, open_time: '06:00:00', close_time: '09:00:00' },
      ];
      blocksState = [
        {
          turf_id: TURF_ID,
          start_datetime: `${dateStr}T06:00:00Z`,
          end_datetime: `${dateStr}T07:00:00Z`,
        },
      ];

      const token = await playerToken();
      const res = await request(app)
        .get(`/turfs/${TURF_ID}/availability`)
        .query({ date: dateStr })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const slotMap = Object.fromEntries(
        res.body.slots.map((s: { start_time: string; status: string }) => [s.start_time, s.status]),
      );
      expect(slotMap['06:00:00']).toBe('BLOCKED');
      expect(slotMap['07:00:00']).toBe('AVAILABLE');
    });

    it('returns an empty slot list when the turf is closed that day', async () => {
      const dateStr = '2026-09-07';
      operatingHours = [];

      const token = await playerToken();
      const res = await request(app)
        .get(`/turfs/${TURF_ID}/availability`)
        .query({ date: dateStr })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.slots).toEqual([]);
    });

    it('rejects a missing/invalid date query parameter', async () => {
      const token = await playerToken();
      const res = await request(app)
        .get(`/turfs/${TURF_ID}/availability`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });
});
