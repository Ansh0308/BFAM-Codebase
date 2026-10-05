// Analytics endpoints (owner: own turfs; admin: whole platform).

const ADMIN = 'aaaaaaaa-0000-4000-8000-006001';
const OWNER = 'aaaaaaaa-0000-4000-8000-006002';
const OTHER_OWNER = 'aaaaaaaa-0000-4000-8000-006003';
const PLAYER = 'aaaaaaaa-0000-4000-8000-006004';
const TURF = 'bbbbbbbb-0000-4000-8000-000000006001';

const seen: Array<{ sql: string; replacements: Record<string, unknown> }> = [];

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      seen.push({ sql, replacements: r });

      if (sql.includes('FROM turfs WHERE turf_id = :turfId AND owner_id = :ownerId')) {
        return r.turfId === TURF && r.ownerId === OWNER ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes('FROM turf_operating_hours')) {
        // open 08:00-20:00 every day = 720 minutes
        return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          turf_id: TURF,
          day_of_week: d,
          open_time: '08:00:00',
          close_time: '20:00:00',
        }));
      }
      if (sql.includes('SUM(b.booking_status = ')) {
        // 10 bookings, 2 cancelled, 8 live = 8 * 60 booked minutes
        return [{ bookings: 10, cancelled: 2, revenue: '9600', minutes: '480', customers: 5 }];
      }
      if (sql.includes("o.due_status = 'PAID'")) return [{ total: '6000' }];
      if (sql.includes('first_date')) return [{ n: 3 }];
      if (sql.includes("mp.attendance_status = 'NO_SHOW'")) return [{ n: 1 }];
      if (sql.includes('GROUP BY b.booking_date')) {
        return [{ d: new Date('2026-10-02T00:00:00Z'), bookings: 3, revenue: '3600' }];
      }
      if (sql.includes('GROUP BY HOUR')) return [{ h: 19, bookings: 4 }];
      if (sql.includes('GROUP BY dow')) return [{ dow: 6, bookings: 5, revenue: '6000' }];
      if (sql.includes('FROM turfs t') && sql.includes('LEFT JOIN bookings b')) {
        return [
          { turf_id: TURF, turf_name: 'Green Park', bookings: 8, revenue: '9600', minutes: '480' },
        ];
      }
      if (sql.includes('GROUP BY b.payment_mode')) return [{ mode: 'UPI', bookings: 6 }];
      if (sql.includes("role = 'PLAYER'") && sql.includes('GROUP BY DATE(created_at)')) {
        return [{ d: '2026-10-03', n: 2 }];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';

async function token(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return `Bearer ${res.body.token as string}`;
}

const RANGE = 'from=2026-10-01&to=2026-10-07';

describe('owner analytics', () => {
  beforeEach(() => {
    seen.length = 0;
  });

  it('is owner-only', async () => {
    const res = await request(app)
      .get(`/owner/analytics?${RANGE}`)
      .set('Authorization', await token(PLAYER, 'PLAYER'));
    expect(res.status).toBe(403);
  });

  it('requires a date range', async () => {
    const res = await request(app)
      .get('/owner/analytics')
      .set('Authorization', await token(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(400);
  });

  it('returns the summary, previous period and filled-in series', async () => {
    const res = await request(app)
      .get(`/owner/analytics?${RANGE}`)
      .set('Authorization', await token(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);

    expect(res.body.range).toEqual({ from: '2026-10-01', to: '2026-10-07', days: 7 });
    expect(res.body.previous_range).toEqual({ from: '2026-09-24', to: '2026-09-30' });

    const s = res.body.summary;
    expect(s).toMatchObject({
      bookings: 10,
      cancelled: 2,
      cancellation_rate: 20,
      revenue: 9600,
      collected: 6000,
      outstanding: 3600,
      avg_booking_value: 1200,
      unique_customers: 5,
      new_customers: 3,
      no_shows: 1,
    });
    // 480 booked minutes / (720 min x 7 days) = 9.52%
    expect(s.occupancy_pct).toBeCloseTo(9.52, 1);

    // every day, hour and weekday present even when empty
    expect(res.body.daily).toHaveLength(7);
    expect(res.body.daily.find((d: { date: string }) => d.date === '2026-10-02')).toMatchObject({
      bookings: 3,
      revenue: 3600,
    });
    expect(res.body.daily.find((d: { date: string }) => d.date === '2026-10-01').bookings).toBe(0);
    expect(res.body.peak_hours).toHaveLength(24);
    expect(res.body.peak_hours[19].bookings).toBe(4);
    expect(res.body.by_weekday).toHaveLength(7);
    expect(res.body.by_weekday[6].bookings).toBe(5);
    expect(res.body.by_turf[0]).toMatchObject({ turf_name: 'Green Park', bookings: 8 });
    expect(res.body.payment_modes).toEqual([{ mode: 'UPI', bookings: 6 }]);
    // owners never get platform growth
    expect(res.body.growth).toBeUndefined();
  });

  it('scopes every query to the calling owner', async () => {
    await request(app)
      .get(`/owner/analytics?${RANGE}`)
      .set('Authorization', await token(OWNER, 'TURF_OWNER'));
    const withOwner = seen.filter((q) => q.sql.includes('t.owner_id = :ownerId'));
    expect(withOwner.length).toBeGreaterThan(5);
    expect(withOwner.every((q) => q.replacements.ownerId === OWNER)).toBe(true);
  });

  it('will not show another owner’s turf', async () => {
    const res = await request(app)
      .get(`/owner/analytics?${RANGE}&turf_id=${TURF}`)
      .set('Authorization', await token(OTHER_OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(404);
  });

  it('allows an owner to filter to one of their turfs', async () => {
    const res = await request(app)
      .get(`/owner/analytics?${RANGE}&turf_id=${TURF}`)
      .set('Authorization', await token(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);
  });

  it('rejects a backwards range and one over a year', async () => {
    const auth = await token(OWNER, 'TURF_OWNER');
    const back = await request(app)
      .get('/owner/analytics?from=2026-10-07&to=2026-10-01')
      .set('Authorization', auth);
    expect(back.status).toBe(400);
    const long = await request(app)
      .get('/owner/analytics?from=2025-01-01&to=2026-10-01')
      .set('Authorization', auth);
    expect(long.status).toBe(400);
    expect(long.body.error.message).toMatch(/366/);
  });
});

describe('admin analytics', () => {
  beforeEach(() => {
    seen.length = 0;
  });

  it('is admin-only', async () => {
    const res = await request(app)
      .get(`/admin/analytics?${RANGE}`)
      .set('Authorization', await token(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(403);
  });

  it('covers the whole platform and adds player growth', async () => {
    const res = await request(app)
      .get(`/admin/analytics?${RANGE}`)
      .set('Authorization', await token(ADMIN, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(seen.some((q) => q.sql.includes('t.owner_id = :ownerId'))).toBe(false);
    expect(res.body.growth).toHaveLength(7);
    expect(res.body.growth.find((g: { date: string }) => g.date === '2026-10-03').new_players).toBe(
      2,
    );
  });
});
