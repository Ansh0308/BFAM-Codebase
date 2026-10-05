// Phase 7: turf approval, staff permissions + activity, owner customers,
// maintenance tracker.

const ADMIN = 'aaaaaaaa-0000-4000-8000-008001';
const OWNER = 'aaaaaaaa-0000-4000-8000-008002';
const OTHER_OWNER = 'aaaaaaaa-0000-4000-8000-008003';
const STAFF = 'aaaaaaaa-0000-4000-8000-008004';
const PLAYER = 'aaaaaaaa-0000-4000-8000-008005';
const TURF = 'bbbbbbbb-0000-4000-8000-000000008001';
const PENDING_TURF = 'bbbbbbbb-0000-4000-8000-000000008002';
const ASSIGNMENT = 'eeeeeeee-0000-4000-8000-000000008001';
const TASK = 'cccccccc-0000-4000-8000-000000008001';

type Row = Record<string, unknown>;
const inserts: Array<{ table: string; rows: Row[] }> = [];
const updates: Array<{ table: string; values: Row; where: Row }> = [];
const deletes: Array<{ table: string; where: Row }> = [];
let assignments: Row[] = [];
let turfStatus = 'PENDING_APPROVAL';
let task: Row | null = null;

jest.mock('../config/sequelize', () => ({
  sequelize: {
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Row[]) => {
        inserts.push({ table, rows });
      },
      bulkUpdate: async (table: string, values: Row, where: Row) => {
        updates.push({ table, values, where });
      },
      bulkDelete: async (table: string, where: Row) => {
        deletes.push({ table, where });
      },
    }),
    query: async (sql: string, options: { replacements?: Row } = {}) => {
      const r = options.replacements ?? {};
      // staff assignments
      if (sql.includes('FROM turf_staff_assignments WHERE assignment_id')) {
        return r.assignmentId === ASSIGNMENT ? [{ ...assignments[0] }] : [];
      }
      if (sql.includes('SELECT turf_id, owner_id FROM turfs WHERE turf_id')) {
        return r.turfId === TURF ? [{ turf_id: TURF, owner_id: OWNER }] : [];
      }
      if (sql.includes('SELECT verification_status, permissions FROM turf_staff_assignments')) {
        return assignments;
      }
      if (sql.includes("resource_type = 'staff_activity'")) {
        return [
          {
            log_id: 'l1',
            action: 'STAFF_CHECK_IN',
            resource_id: 'm1',
            after_data: '{"turf_id":"x","status":"CHECKED_IN"}',
            created_at: new Date(),
          },
        ];
      }
      // customers
      if (sql.includes('GROUP BY b.booked_by')) {
        const today = new Date();
        const ago = (d: number) =>
          new Date(today.getTime() - d * 86_400_000).toISOString().slice(0, 10);
        return [
          {
            user_id: 'p1',
            name: 'Asha',
            phone_number: '+9111',
            visits: '5',
            cancelled: '1',
            total_spend: '6000',
            first_booking: ago(100),
            last_booking: ago(5),
            no_shows: '0',
          },
          {
            user_id: 'p2',
            name: null,
            phone_number: '+9122',
            visits: '1',
            cancelled: '0',
            total_spend: '800',
            first_booking: ago(3),
            last_booking: ago(3),
            no_shows: '1',
          },
          {
            user_id: 'p3',
            name: 'Dev',
            phone_number: '+9133',
            visits: '2',
            cancelled: '0',
            total_spend: '1500',
            first_booking: ago(200),
            last_booking: ago(90),
            no_shows: '0',
          },
        ];
      }
      if (sql.includes('ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 50')) {
        return [
          {
            booking_id: 'b1',
            turf_name: 'Green Park',
            booking_date: '2026-10-01',
            start_time: '18:00:00',
            end_time: '19:00:00',
            booking_amount: '1200',
            booking_status: 'COMPLETED',
            payment_mode: 'UPI',
          },
        ];
      }
      // maintenance
      if (sql.includes('FROM turfs WHERE turf_id = :turfId AND owner_id = :ownerId')) {
        return r.turfId === TURF && r.ownerId === OWNER ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes('m.task_id = :taskId')) {
        const made = inserts.find(
          (i) => i.table === 'maintenance_tasks' && i.rows[0].task_id === r.taskId,
        );
        if (made) return [{ ...made.rows[0], turf_name: 'Green Park' }];
        return task && r.taskId === TASK && r.ownerId === OWNER ? [task] : [];
      }
      if (sql.includes('FROM maintenance_tasks m')) return task ? [task] : [];
      // turf approval
      if (sql.includes('SELECT turf_status, owner_id, turf_name FROM turfs')) {
        return r.turfId === PENDING_TURF
          ? [{ turf_status: turfStatus, owner_id: OWNER, turf_name: 'New Pitch' }]
          : [];
      }
      if (sql.includes('FROM turfs t') && sql.includes('JOIN users u')) {
        return [
          {
            turf_id: PENDING_TURF,
            turf_name: 'New Pitch',
            turf_status: turfStatus,
            owner_id: OWNER,
            rejection_reason: null,
          },
        ];
      }
      // owner creating a turf
      if (sql.includes('SELECT t.*, v.venue_name FROM turfs t')) {
        const made = inserts.find((i) => i.table === 'turfs');
        return made ? [made.rows[0]] : [];
      }
      if (sql.includes('SELECT turf_id, owner_id FROM turfs'))
        return [{ turf_id: TURF, owner_id: OWNER }];
      if (sql.includes('SELECT turf_id, owner_id, venue_id FROM turfs')) {
        const made = inserts.find((i) => i.table === 'turfs');
        return made
          ? [{ turf_id: made.rows[0].turf_id, owner_id: made.rows[0].owner_id, venue_id: null }]
          : [];
      }
      // act-as
      if (sql.includes("role IN ('TURF_OWNER', 'TURF_STAFF')")) {
        return r.targetId === OWNER ? [{ user_id: OWNER, role: 'TURF_OWNER' }] : [];
      }
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';
import { segmentFor } from '../services/customerService';
import { assertStaffVerified, normalizePermissions } from '../services/staffService';
import { StaffNotVerifiedError, StaffPermissionDeniedError } from '../domain/errors';

async function auth(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return `Bearer ${res.body.token as string}`;
}

const assignment = (over: Row = {}): Row => ({
  assignment_id: ASSIGNMENT,
  turf_id: TURF,
  staff_user_id: STAFF,
  permissions: {},
  assigned_by: OWNER,
  status: 'ACTIVE',
  verification_status: 'APPROVED',
  verification_document_url: null,
  verified_by: null,
  verified_at: null,
  rejection_reason: null,
  created_at: new Date(),
  ...over,
});

beforeEach(() => {
  inserts.length = 0;
  updates.length = 0;
  deletes.length = 0;
  assignments = [assignment()];
  turfStatus = 'PENDING_APPROVAL';
  task = null;
});

describe('customer segments', () => {
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  it.each([
    ['NEW', 1, day(10), day(2)],
    ['REGULAR', 4, day(200), day(15)],
    ['LAPSED', 3, day(300), day(90)],
    ['OCCASIONAL', 2, day(120), day(40)],
  ] as const)('%s', (expected, visits, first, last) => {
    expect(segmentFor(visits, first, last)).toBe(expected);
  });

  it('a customer with no completed visit is lapsed, not crashing', () => {
    expect(segmentFor(0, null, null)).toBe('LAPSED');
  });
});

describe('owner customers', () => {
  it('is owner-only', async () => {
    const res = await request(app)
      .get('/owner/customers')
      .set('Authorization', await auth(PLAYER, 'PLAYER'));
    expect(res.status).toBe(403);
  });

  it('lists customers with spend, visits and a segment', async () => {
    const res = await request(app)
      .get('/owner/customers')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);
    const asha = res.body.results.find((c: Row) => c.user_id === 'p1');
    expect(asha).toMatchObject({
      name: 'Asha',
      visits: 5,
      total_spend: 6000,
      cancelled: 1,
      segment: 'REGULAR',
    });
    expect(res.body.results.find((c: Row) => c.user_id === 'p2')).toMatchObject({
      segment: 'NEW',
      no_shows: 1,
    });
    // no email or other personal fields leak
    expect(Object.keys(asha).sort()).toEqual([
      'cancelled',
      'first_booking',
      'last_booking',
      'name',
      'no_shows',
      'phone_number',
      'segment',
      'total_spend',
      'user_id',
      'visits',
    ]);
  });

  it('filters by segment', async () => {
    const res = await request(app)
      .get('/owner/customers?segment=LAPSED')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.body.results.map((c: Row) => c.user_id)).toEqual(['p3']);
  });

  it('shows one customer’s bookings, and 404s a stranger', async () => {
    const ok = await request(app)
      .get('/owner/customers/p1')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(ok.status).toBe(200);
    expect(ok.body.bookings[0]).toMatchObject({ turf_name: 'Green Park', booking_amount: 1200 });
    const missing = await request(app)
      .get('/owner/customers/nobody')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(missing.status).toBe(404);
  });
});

describe('maintenance tracker', () => {
  const TASK_ROW = (over: Row = {}): Row => ({
    task_id: TASK,
    turf_id: TURF,
    turf_name: 'Green Park',
    title: 'Re-roll pitch',
    description: null,
    category: 'PITCH',
    priority: 'HIGH',
    status: 'OPEN',
    due_date: '2020-01-01',
    cost: '1500.00',
    assigned_to: null,
    completed_at: null,
    created_at: new Date(),
    ...over,
  });

  it('flags overdue tasks and totals cost as numbers', async () => {
    task = TASK_ROW();
    const res = await request(app)
      .get('/owner/maintenance')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({
      overdue: true,
      cost: 1500,
      due_date: '2020-01-01',
    });
  });

  it('a finished task is never overdue', async () => {
    task = TASK_ROW({ status: 'DONE' });
    const res = await request(app)
      .get('/owner/maintenance')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.body.results[0].overdue).toBe(false);
  });

  it('creates a task only for the owner’s own turf', async () => {
    task = TASK_ROW();
    const ok = await request(app)
      .post('/owner/maintenance')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({
        turf_id: TURF,
        title: 'Fix floodlight',
        category: 'LIGHTING',
        priority: 'HIGH',
        cost: 800,
      });
    expect(ok.status).toBe(201);
    expect(inserts.find((i) => i.table === 'maintenance_tasks')?.rows[0]).toMatchObject({
      status: 'OPEN',
      category: 'LIGHTING',
      created_by: OWNER,
    });

    inserts.length = 0;
    const foreign = await request(app)
      .post('/owner/maintenance')
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'))
      .send({ turf_id: TURF, title: 'Not mine' });
    expect(foreign.status).toBe(404);
    expect(inserts).toHaveLength(0);
  });

  it('needs a title and valid fields', async () => {
    const auth1 = await auth(OWNER, 'TURF_OWNER');
    expect(
      (
        await request(app)
          .post('/owner/maintenance')
          .set('Authorization', auth1)
          .send({ turf_id: TURF })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/owner/maintenance')
          .set('Authorization', auth1)
          .send({ turf_id: TURF, title: 'x y', priority: 'URGENT' })
      ).status,
    ).toBe(400);
  });

  it('moving to done stamps the completion time; reopening clears it', async () => {
    task = TASK_ROW();
    await request(app)
      .patch(`/owner/maintenance/${TASK}`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ status: 'DONE' });
    const done = updates.find((u) => u.table === 'maintenance_tasks')!.values;
    expect(done.status).toBe('DONE');
    expect(done.completed_at).toBeInstanceOf(Date);

    updates.length = 0;
    task = TASK_ROW({ status: 'DONE' });
    await request(app)
      .patch(`/owner/maintenance/${TASK}`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ status: 'OPEN' });
    expect(updates.find((u) => u.table === 'maintenance_tasks')!.values.completed_at).toBeNull();
  });

  it('another owner cannot edit or delete it', async () => {
    task = TASK_ROW();
    const edit = await request(app)
      .patch(`/owner/maintenance/${TASK}`)
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'))
      .send({ title: 'Hijack' });
    expect(edit.status).toBe(404);
    const del = await request(app)
      .delete(`/owner/maintenance/${TASK}`)
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'));
    expect(del.status).toBe(404);
    expect(deletes).toHaveLength(0);

    const mine = await request(app)
      .delete(`/owner/maintenance/${TASK}`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(mine.status).toBe(204);
    expect(deletes[0].where).toEqual({ task_id: TASK });
  });
});

describe('staff permissions', () => {
  it('everything is allowed by default, and only an explicit false turns it off', () => {
    expect(normalizePermissions({})).toEqual({
      check_in: true,
      collect_cash: true,
      score_matches: true,
    });
    expect(normalizePermissions(null)).toEqual({
      check_in: true,
      collect_cash: true,
      score_matches: true,
    });
    expect(normalizePermissions('{"collect_cash":false}')).toEqual({
      check_in: true,
      collect_cash: false,
      score_matches: true,
    });
    expect(normalizePermissions('not json').check_in).toBe(true);
  });

  it('blocks an unverified staff member from every action', async () => {
    assignments = [assignment({ verification_status: 'PENDING' })];
    await expect(assertStaffVerified(STAFF, 'check_in')).rejects.toBeInstanceOf(
      StaffNotVerifiedError,
    );
  });

  it('blocks only the action the owner switched off', async () => {
    assignments = [assignment({ permissions: { collect_cash: false } })];
    await expect(assertStaffVerified(STAFF, 'collect_cash')).rejects.toBeInstanceOf(
      StaffPermissionDeniedError,
    );
    await expect(assertStaffVerified(STAFF, 'collect_cash')).rejects.toThrow(/collect cash/);
    await expect(assertStaffVerified(STAFF, 'check_in')).resolves.toBeUndefined();
    await expect(assertStaffVerified(STAFF)).resolves.toBeUndefined();
  });

  it('a denial still maps to 403 wherever the verification error does', () => {
    expect(new StaffPermissionDeniedError('score matches')).toBeInstanceOf(StaffNotVerifiedError);
  });

  it('works across several turfs: one that grants it is enough', async () => {
    assignments = [
      assignment({ permissions: { check_in: false } }),
      assignment({ assignment_id: 'a2', permissions: {} }),
    ];
    await expect(assertStaffVerified(STAFF, 'check_in')).resolves.toBeUndefined();
  });

  it('the owner switches a permission and it is saved with an audit entry', async () => {
    const res = await request(app)
      .patch(`/owner/staff/${ASSIGNMENT}/permissions`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ collect_cash: false, bogus: true });
    expect(res.status).toBe(200);
    expect(
      JSON.parse(
        updates.find((u) => u.table === 'turf_staff_assignments')!.values.permissions as string,
      ),
    ).toEqual({
      check_in: true,
      collect_cash: false,
      score_matches: true,
    });
    expect(inserts.find((i) => i.table === 'audit_logs')?.rows[0]).toMatchObject({
      action: 'STAFF_PERMISSIONS_CHANGED',
    });
  });

  it('only that turf’s owner can change them', async () => {
    const res = await request(app)
      .patch(`/owner/staff/${ASSIGNMENT}/permissions`)
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'))
      .send({ check_in: false });
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it('shows what the staff member did', async () => {
    const res = await request(app)
      .get(`/owner/staff/${ASSIGNMENT}/activity`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({
      action: 'STAFF_CHECK_IN',
      details: { status: 'CHECKED_IN' },
    });
    const other = await request(app)
      .get(`/owner/staff/${ASSIGNMENT}/activity`)
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'));
    expect(other.status).toBe(403);
  });
});

describe('turf approval', () => {
  it('a turf an owner creates waits for approval', async () => {
    const res = await request(app)
      .post('/owner/turfs')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({
        turf_name: 'Fresh Pitch',
        address_line: '1 Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    expect(res.status).toBe(201);
    expect(inserts.find((i) => i.table === 'turfs')?.rows[0]).toMatchObject({
      turf_status: 'PENDING_APPROVAL',
    });
  });

  it('an admin working as the owner publishes straight away', async () => {
    const res = await request(app)
      .post('/owner/turfs')
      .set('Authorization', await auth(ADMIN, 'ADMIN'))
      .set('X-Act-As-User', OWNER)
      .send({
        turf_name: 'Admin Pitch',
        address_line: '1 Road',
        city: 'Rajkot',
        latitude: 22.3,
        longitude: 70.8,
      });
    expect(res.status).toBe(201);
    expect(inserts.find((i) => i.table === 'turfs')?.rows[0]).toMatchObject({
      turf_status: 'ACTIVE',
    });
  });

  it('only an admin approves, and the turf goes live', async () => {
    const owner = await request(app)
      .post(`/admin/turfs/${PENDING_TURF}/approve`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(owner.status).toBe(403);

    const res = await request(app)
      .post(`/admin/turfs/${PENDING_TURF}/approve`)
      .set('Authorization', await auth(ADMIN, 'ADMIN'));
    expect(res.status).toBe(200);
    expect(updates.find((u) => u.table === 'turfs')?.values).toMatchObject({
      turf_status: 'ACTIVE',
      rejection_reason: null,
    });
    expect(inserts.find((i) => i.table === 'audit_logs')?.rows[0]).toMatchObject({
      action: 'TURF_APPROVED',
    });
  });

  it('rejecting needs a reason the owner can read', async () => {
    const admin = await auth(ADMIN, 'ADMIN');
    expect(
      (
        await request(app)
          .post(`/admin/turfs/${PENDING_TURF}/reject`)
          .set('Authorization', admin)
          .send({})
      ).status,
    ).toBe(400);
    const res = await request(app)
      .post(`/admin/turfs/${PENDING_TURF}/reject`)
      .set('Authorization', admin)
      .send({ reason: 'Photos are missing' });
    expect(res.status).toBe(200);
    expect(updates.find((u) => u.table === 'turfs')?.values).toMatchObject({
      turf_status: 'REJECTED',
      rejection_reason: 'Photos are missing',
    });
  });

  it('cannot approve a turf that is already live, or one that does not exist', async () => {
    turfStatus = 'ACTIVE';
    const live = await request(app)
      .post(`/admin/turfs/${PENDING_TURF}/approve`)
      .set('Authorization', await auth(ADMIN, 'ADMIN'));
    expect(live.status).toBe(409);
    const missing = await request(app)
      .post('/admin/turfs/bbbbbbbb-0000-4000-8000-00000000ffff/approve')
      .set('Authorization', await auth(ADMIN, 'ADMIN'));
    expect(missing.status).toBe(404);
  });

  it('the plain status switch cannot be used to skip approval', async () => {
    const res = await request(app)
      .patch(`/admin/turfs/${PENDING_TURF}/status`)
      .set('Authorization', await auth(ADMIN, 'ADMIN'))
      .send({ turf_status: 'PENDING_APPROVAL' });
    expect(res.status).toBe(400);
  });
});
