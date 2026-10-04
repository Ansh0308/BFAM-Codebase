// Admin Web console endpoints (PRD §9.1 / §30.10): overview, support queue,
// audit-log viewer and the promo-code switch. All ADMIN-only.

const ADMIN = 'aaaaaaaa-0000-4000-8000-004001';
const PLAYER = 'aaaaaaaa-0000-4000-8000-004002';
const PROMO = 'bbbbbbbb-0000-4000-8000-000000004003';

const queries: Array<{ sql: string; replacements: Record<string, unknown> }> = [];
const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
const inserts: Array<{ table: string; rows: Array<Record<string, unknown>> }> = [];

jest.mock('../config/sequelize', () => ({
  sequelize: {
    getQueryInterface: () => ({
      bulkUpdate: async (table: string, values: Record<string, unknown>) => {
        updates.push({ table, values });
      },
      bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
        inserts.push({ table, rows });
      },
    }),
    query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
      const r = options.replacements ?? {};
      queries.push({ sql, replacements: r });
      if (sql.includes('FROM promo_codes WHERE promo_code_id')) {
        return r.promoCodeId === PROMO ? [{ code: 'WELCOME', is_active: 1 }] : [];
      }
      if (sql.includes('FROM audit_logs l') && sql.includes('LIMIT')) {
        return [
          {
            log_id: 'l1',
            action: 'BOOKING_CANCELLED',
            resource_type: 'booking',
            resource_id: 'b1',
            actor_phone: '+919999999999',
            before_data: '{"booking_status":"CONFIRMED"}',
            after_data: { booking_status: 'CANCELLED' },
            created_at: new Date(),
          },
        ];
      }
      if (sql.includes('FROM support_tickets t')) {
        return [
          {
            ticket_id: 't1',
            status: 'OPEN',
            dispute_type: 'COMPLAINT',
            raised_by_phone: '+911111111111',
          },
        ];
      }
      if (sql.includes('GROUP BY status')) {
        return [
          { status: 'OPEN', n: '2' },
          { status: 'CLOSED', n: 5 },
        ];
      }
      if (sql.includes('SUM(amount)')) return [{ n: '15000' }];
      if (sql.includes('COUNT(*) AS n')) return [{ n: 7 }];
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

describe('admin console', () => {
  beforeEach(() => {
    queries.length = 0;
    updates.length = 0;
    inserts.length = 0;
  });

  it('is admin-only', async () => {
    for (const path of ['/admin/overview', '/admin/tickets', '/admin/audit-logs']) {
      const res = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${await token(PLAYER, 'PLAYER')}`);
      expect(res.status).toBe(403);
    }
  });

  it('GET /admin/overview returns platform totals and recent activity', async () => {
    const res = await request(app)
      .get('/admin/overview')
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`);

    expect(res.status).toBe(200);
    expect(res.body.users.players).toBe(7);
    expect(res.body.revenue.last_30_days).toBe(15000);
    expect(res.body.recent_activity[0].action).toBe('BOOKING_CANCELLED');
  });

  it('GET /admin/tickets returns the queue with real status totals', async () => {
    const res = await request(app)
      .get('/admin/tickets?status=OPEN&dispute_type=COMPLAINT')
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`);

    expect(res.status).toBe(200);
    expect(res.body.results[0].raised_by_phone).toBe('+911111111111');
    expect(res.body.counts).toEqual({ OPEN: 2, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 5 });
    const q = queries.find((x) => x.sql.includes('FROM support_tickets t'));
    expect(q?.replacements).toMatchObject({ status: 'OPEN', disputeType: 'COMPLAINT' });
  });

  it('rejects an unknown ticket status filter', async () => {
    const res = await request(app)
      .get('/admin/tickets?status=NOPE')
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`);
    expect(res.status).toBe(400);
  });

  it('GET /admin/audit-logs paginates, filters, and returns parsed JSON', async () => {
    const res = await request(app)
      .get('/admin/audit-logs?resource_type=booking&limit=10&offset=20')
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(7);
    expect(res.body.results[0].before_data).toEqual({ booking_status: 'CONFIRMED' });
    const q = queries.find((x) => x.sql.includes('LIMIT'));
    expect(q?.replacements).toMatchObject({ resourceType: 'booking', limit: 10, offset: 20 });
  });

  it('caps the audit log page size', async () => {
    const res = await request(app)
      .get('/admin/audit-logs?limit=5000')
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`);
    expect(res.status).toBe(400);
  });

  it('switches a promo code off and records it in the audit log', async () => {
    const res = await request(app)
      .post(`/admin/promo-codes/${PROMO}/active`)
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ promo_code_id: PROMO, is_active: false });
    expect(updates[0]).toMatchObject({ table: 'promo_codes', values: { is_active: false } });
    expect(inserts.find((i) => i.table === 'audit_logs')?.rows[0]).toMatchObject({
      action: 'PROMO_CODE_TOGGLED',
    });
  });

  it('404s for an unknown promo code and 400s without is_active', async () => {
    const missing = await request(app)
      .post('/admin/promo-codes/cccccccc-0000-4000-8000-000000000000/active')
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`)
      .send({ is_active: true });
    expect(missing.status).toBe(404);

    const bad = await request(app)
      .post(`/admin/promo-codes/${PROMO}/active`)
      .set('Authorization', `Bearer ${await token(ADMIN, 'ADMIN')}`)
      .send({});
    expect(bad.status).toBe(400);
  });
});
