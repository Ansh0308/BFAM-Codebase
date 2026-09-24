// Exercises GET /admin/turfs and PATCH /admin/turfs/:turfId/status
// (backlog E-3). Only `sequelize` is faked — the real routes/services run
// unmodified.

interface TurfRow {
  turf_id: string;
  turf_name: string;
  city: string;
  turf_status: string;
  average_rating: string | null;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

interface UserRow {
  user_id: string;
  full_name: string | null;
  phone_number: string;
}

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-000000000901';
const OWNER_ID = 'bbbbbbbb-0000-4000-8000-000000000902';

let turfs: TurfRow[];
let users: UserRow[];
let auditLogs: Array<Record<string, unknown>>;

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};
        if (sql.includes('FROM turfs t') && sql.includes('JOIN users u')) {
          return turfs.map((t) => {
            const owner = users.find((u) => u.user_id === t.owner_id);
            return {
              ...t,
              owner_name: owner?.full_name ?? null,
              owner_phone: owner?.phone_number ?? '',
            };
          });
        }
        if (sql.includes('SELECT turf_status FROM turfs WHERE turf_id')) {
          const t = turfs.find((x) => x.turf_id === r.turfId);
          return t ? [{ turf_status: t.turf_status }] : [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      getQueryInterface: () => ({
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'turfs') {
            const t = turfs.find((x) => x.turf_id === where.turf_id);
            if (t) Object.assign(t, values);
          }
        },
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'audit_logs') auditLogs.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

async function tokenFor(role: 'ADMIN' | 'PLAYER', userId: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return res.body.token as string;
}

describe('Admin Turf Management (backlog E-3)', () => {
  beforeEach(() => {
    turfs = [
      {
        turf_id: 'turf-1',
        turf_name: 'Green Park Box Cricket',
        city: 'Rajkot',
        turf_status: 'ACTIVE',
        average_rating: '4.5',
        owner_id: OWNER_ID,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    users = [{ user_id: OWNER_ID, full_name: 'Ravi Owner', phone_number: '+919876500000' }];
    auditLogs = [];
  });

  describe('GET /admin/turfs', () => {
    it('lists every turf across every owner, with the owner name attached', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app).get('/admin/turfs').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0]).toMatchObject({
        turf_id: 'turf-1',
        owner_name: 'Ravi Owner',
      });
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', OWNER_ID);
      const res = await request(app).get('/admin/turfs').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /admin/turfs/:turfId/status', () => {
    it('suspends a turf and writes an audit log entry', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/turfs/turf-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ turf_status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.turf_status).toBe('SUSPENDED');
      expect(turfs[0].turf_status).toBe('SUSPENDED');
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        action: 'TURF_STATUS_CHANGED',
        resource_id: 'turf-1',
        actor_user_id: ADMIN_ID,
        actor_role: 'ADMIN',
      });
    });

    it('reactivates a suspended turf', async () => {
      turfs[0].turf_status = 'SUSPENDED';
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/turfs/turf-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ turf_status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(turfs[0].turf_status).toBe('ACTIVE');
    });

    it('returns 404 for an unknown turf', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/turfs/not-a-real-turf/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ turf_status: 'SUSPENDED' });
      expect(res.status).toBe(404);
    });

    it('rejects an invalid status value', async () => {
      const token = await tokenFor('ADMIN', ADMIN_ID);
      const res = await request(app)
        .patch('/admin/turfs/turf-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ turf_status: 'NOT_A_STATUS' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-admin caller', async () => {
      const token = await tokenFor('PLAYER', OWNER_ID);
      const res = await request(app)
        .patch('/admin/turfs/turf-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ turf_status: 'SUSPENDED' });
      expect(res.status).toBe(403);
    });
  });
});
