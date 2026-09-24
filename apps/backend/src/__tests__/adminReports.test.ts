// Exercises GET /admin/reports (backlog E-6). Only `sequelize` is faked —
// the real routes/services run unmodified.

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-001301';
const PLAYER_ID = 'bbbbbbbb-0000-4000-8000-001302';

let counts: Record<string, number>;
let sums: Record<string, number | null>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string) => {
        if (sql.includes('COUNT(*) AS count FROM bookings WHERE booking_status')) {
          return [{ count: counts.cancelledBookings }];
        }
        if (sql.includes('COUNT(*) AS count FROM bookings')) {
          return [{ count: counts.totalBookings }];
        }
        if (sql.includes('SUM(amount) AS total FROM payments')) {
          return [{ total: sums.revenue }];
        }
        if (sql.includes('SUM(refund_amount) AS total FROM refunds')) {
          return [{ total: sums.refunds }];
        }
        if (sql.includes("role = 'PLAYER'")) {
          return [{ count: counts.activePlayers }];
        }
        if (sql.includes('FROM turfs WHERE')) {
          return [{ count: counts.activeTurfs }];
        }
        if (sql.includes('FROM teams WHERE')) {
          return [{ count: counts.activeTeams }];
        }
        if (sql.includes("FROM matches WHERE match_status = 'COMPLETED'")) {
          return [{ count: counts.matchesCompleted }];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(role: 'ADMIN' | 'PLAYER', userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Admin Reports (backlog E-6)', () => {
  beforeEach(() => {
    counts = {
      totalBookings: 100,
      cancelledBookings: 15,
      activePlayers: 250,
      activeTurfs: 20,
      activeTeams: 30,
      matchesCompleted: 80,
    };
    sums = { revenue: 500000, refunds: 12000 };
  });

  it('returns the business report with correctly computed cancellation rate', async () => {
    const token = await tokenFor('ADMIN', ADMIN_ID);
    const res = await request(app).get('/admin/reports').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_bookings: 100,
      cancelled_bookings: 15,
      cancellation_rate: 15,
      total_revenue: 500000,
      total_refunds: 12000,
      active_players: 250,
      active_turfs: 20,
      active_teams: 30,
      matches_completed: 80,
    });
  });

  it('reports a 0 cancellation rate and 0 revenue when there are no bookings/payments yet', async () => {
    counts.totalBookings = 0;
    counts.cancelledBookings = 0;
    sums.revenue = null;
    sums.refunds = null;

    const token = await tokenFor('ADMIN', ADMIN_ID);
    const res = await request(app).get('/admin/reports').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cancellation_rate).toBe(0);
    expect(res.body.total_revenue).toBe(0);
    expect(res.body.total_refunds).toBe(0);
  });

  it('rejects a non-admin caller', async () => {
    const token = await tokenFor('PLAYER', PLAYER_ID);
    const res = await request(app).get('/admin/reports').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
