// Web Phase 2: the owner's date-range bookings list, the payments list that
// now carries the collector + booking, and read-only booking lookup for
// staff assigned to the turf (desk verification).

const OWNER = 'aaaaaaaa-0000-4000-8000-003001';
const STAFF = 'aaaaaaaa-0000-4000-8000-003002';
const OTHER_STAFF = 'aaaaaaaa-0000-4000-8000-003003';
const PLAYER = 'aaaaaaaa-0000-4000-8000-003004';
const TURF = 'bbbbbbbb-0000-4000-8000-000000003005';
const BOOKING = 'cccccccc-0000-4000-8000-003006';

const queries: Array<{ sql: string; replacements: Record<string, unknown> }> = [];

jest.mock('../config/sequelize', () => ({
  sequelize: {
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      queries.push({ sql, replacements: r });
      if (sql.includes('FROM bookings WHERE booking_id')) {
        return r.bookingId === BOOKING
          ? [{ booking_id: BOOKING, turf_id: TURF, booked_by: PLAYER, booking_status: 'CONFIRMED' }]
          : [];
      }
      if (sql.includes('FROM turf_staff_assignments')) {
        return r.staffUserId === STAFF && r.turfId === TURF ? [{ assignment_id: 'a1' }] : [];
      }
      if (sql.includes('FROM turfs WHERE turf_id')) return [{ turf_id: TURF, owner_id: OWNER }];
      if (sql.includes('FROM bookings b') && sql.includes('customer_phone')) {
        return [{ booking_id: BOOKING, turf_name: 'Redline', amount_due: 1000, amount_paid: 400 }];
      }
      if (sql.includes('FROM payments p')) {
        return [{ payment_id: 'p1', payment_method: 'CASH', collector_phone: '+919999999999' }];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';

async function token(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('GET /owner/bookings', () => {
  beforeEach(() => {
    queries.length = 0;
  });

  it('returns bookings with customer and payment totals for the date range', async () => {
    const res = await request(app)
      .get('/owner/bookings?from=2026-10-01&to=2026-10-07')
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ amount_due: 1000, amount_paid: 400 });
    const q = queries.find((x) => x.sql.includes('customer_phone'));
    expect(q?.replacements).toMatchObject({
      ownerUserId: OWNER,
      from: '2026-10-01',
      to: '2026-10-07',
    });
  });

  it('can be narrowed to one turf', async () => {
    const res = await request(app)
      .get(`/owner/bookings?from=2026-10-01&to=2026-10-01&turf_id=${TURF}`)
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);

    expect(res.status).toBe(200);
    const q = queries.find((x) => x.sql.includes('customer_phone'));
    expect(q?.sql).toContain('b.turf_id = :turfId');
    expect(q?.replacements.turfId).toBe(TURF);
  });

  it('rejects a missing or malformed range', async () => {
    const res = await request(app)
      .get('/owner/bookings?from=yesterday')
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);
    expect(res.status).toBe(400);
  });

  it('rejects a range longer than 62 days', async () => {
    const res = await request(app)
      .get('/owner/bookings?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/62 days/);
  });

  it('is owner-only', async () => {
    const res = await request(app)
      .get('/owner/bookings?from=2026-10-01&to=2026-10-02')
      .set('Authorization', `Bearer ${await token(PLAYER, 'PLAYER')}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /owner/payments', () => {
  it('includes who collected each cash payment', async () => {
    const res = await request(app)
      .get('/owner/payments')
      .set('Authorization', `Bearer ${await token(OWNER, 'TURF_OWNER')}`);
    expect(res.status).toBe(200);
    expect(res.body.results[0].collector_phone).toBe('+919999999999');
  });
});

describe('GET /bookings/:id for staff', () => {
  it('lets staff assigned to the turf look a booking up', async () => {
    const res = await request(app)
      .get(`/bookings/${BOOKING}`)
      .set('Authorization', `Bearer ${await token(STAFF, 'TURF_STAFF')}`);
    expect(res.status).toBe(200);
    expect(res.body.booking_id).toBe(BOOKING);
  });

  it('still refuses staff who are not assigned to that turf', async () => {
    const res = await request(app)
      .get(`/bookings/${BOOKING}`)
      .set('Authorization', `Bearer ${await token(OTHER_STAFF, 'TURF_STAFF')}`);
    expect(res.status).toBe(403);
  });

  it('does not let staff cancel the booking', async () => {
    const res = await request(app)
      .post(`/bookings/${BOOKING}/cancel`)
      .set('Authorization', `Bearer ${await token(STAFF, 'TURF_STAFF')}`)
      .send({ cancellation_reason: 'nope' });
    expect(res.status).toBe(403);
  });
});
