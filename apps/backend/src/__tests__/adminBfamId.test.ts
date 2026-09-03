// Exercises the admin BFAM ID reservation system end-to-end through
// supertest: locking a premium ID out of the normal allocator, the
// allocator actually skipping it during real registrations, unlocking, and
// manually assigning a locked ID to an existing player. Only the low-level
// `sequelize` driver calls are faked, since no real MySQL is available in
// this test environment (see registration.test.ts for the same pattern).

let usersTable: Array<Record<string, unknown>> = [];
let playersTable: Array<Record<string, unknown>> = [];
let reservationsTable: Array<Record<string, unknown>> = [];
let lockHeld = false;
const lockWaiters: Array<() => void> = [];

async function acquireLock(): Promise<void> {
  if (!lockHeld) {
    lockHeld = true;
    return;
  }
  await new Promise<void>((resolve) => lockWaiters.push(resolve));
  lockHeld = true;
}

function releaseLock(): void {
  lockHeld = false;
  const next = lockWaiters.shift();
  if (next) next();
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.includes('GET_LOCK')) {
          await acquireLock();
          return [{ locked: 1 }];
        }
        if (sql.includes('RELEASE_LOCK')) {
          releaseLock();
          return [{}];
        }
        if (sql.includes('MAX(CAST(SUBSTRING')) {
          const numbers = usersTable.map((u) => Number(String(u.bfam_id).replace('BF', '')));
          const max = numbers.length ? Math.max(...numbers) : null;
          return [{ max_id: max === null ? null : String(max) }];
        }
        if (
          sql.includes('SELECT reservation_id FROM reserved_bfam_ids') &&
          sql.includes("status = 'LOCKED'")
        ) {
          const match = reservationsTable.find(
            (x) => x.bfam_id === r.bfamId && x.status === 'LOCKED',
          );
          return match ? [{ reservation_id: match.reservation_id }] : [];
        }
        if (sql.startsWith('SELECT user_id FROM users WHERE bfam_id')) {
          const match = usersTable.find((u) => u.bfam_id === r.bfamId);
          return match ? [{ user_id: match.user_id }] : [];
        }
        if (sql.startsWith('SELECT reservation_id, status FROM reserved_bfam_ids')) {
          const match = reservationsTable.find((x) => x.bfam_id === r.bfamId);
          return match ? [{ reservation_id: match.reservation_id, status: match.status }] : [];
        }
        if (sql.startsWith('SELECT user_id, role FROM users WHERE user_id')) {
          const match = usersTable.find((u) => u.user_id === r.id && !u.deleted_at);
          return match ? [{ user_id: match.user_id, role: match.role }] : [];
        }
        if (sql.startsWith('DELETE FROM reserved_bfam_ids')) {
          reservationsTable = reservationsTable.filter((x) => x.reservation_id !== r.id);
          return [];
        }
        if (sql.startsWith('UPDATE users SET bfam_id')) {
          const user = usersTable.find((u) => u.user_id === r.id);
          if (user) user.bfam_id = r.bfamId;
          return [];
        }
        if (sql.startsWith('UPDATE reserved_bfam_ids SET status')) {
          const reservation = reservationsTable.find((x) => x.reservation_id === r.id);
          if (reservation) {
            reservation.status = 'ASSIGNED';
            reservation.assigned_to_user_id = r.userId;
          }
          return [];
        }
        if (sql.startsWith('SELECT reservation_id, bfam_id, status')) {
          return [...reservationsTable].sort(
            (a, b) => (b.locked_at as Date).getTime() - (a.locked_at as Date).getTime(),
          );
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'users') {
            for (const row of rows) {
              if (usersTable.some((u) => u.phone_number === row.phone_number)) {
                throw new Error('Duplicate entry for phone_number');
              }
            }
            usersTable.push(...rows);
          } else if (table === 'players') {
            playersTable.push(...rows);
          } else if (table === 'reserved_bfam_ids') {
            reservationsTable.push(...rows);
          }
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';
import { issueJwt } from '../services/authService';

function adminToken() {
  return issueJwt({ userId: 'admin-1', role: 'ADMIN', bfamId: null });
}

describe('Admin BFAM ID reservation system', () => {
  beforeEach(() => {
    usersTable = [];
    playersTable = [];
    reservationsTable = [];
    lockHeld = false;
    lockWaiters.length = 0;
  });

  it('rejects lock/unlock/assign/list for a non-admin', async () => {
    const playerToken = issueJwt({ userId: 'p1', role: 'PLAYER', bfamId: 'BF1000' });

    const lock = await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bfam_id: 'BF7' });
    expect(lock.status).toBe(403);

    const list = await request(app)
      .get('/admin/bfam-ids')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(list.status).toBe(403);
  });

  it('locks a BFAM ID, then the sequential allocator skips it during real registrations', async () => {
    const lockResponse = await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bfam_id: 'BF1000', notes: 'Reserved for a sponsor' });
    expect(lockResponse.status).toBe(201);
    expect(lockResponse.body.status).toBe('LOCKED');

    const registerResponse = await request(app).post('/auth/register').send({
      phone_number: '+919876500099',
      password: 'SuperSecret123',
      role: 'PLAYER',
      waiver_accepted: true,
    });

    expect(registerResponse.status).toBe(201);
    // BF1000 is locked, so the very first player registration must skip it.
    expect(registerResponse.body.bfam_id).toBe('BF1001');
  });

  it('rejects locking an ID that is already assigned to a user', async () => {
    usersTable.push({ user_id: 'u1', phone_number: '+919876500001', bfam_id: 'BF1000' });

    const response = await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bfam_id: 'BF1000' });
    expect(response.status).toBe(409);
  });

  it('unlocks a reservation, returning it to the normal allocation pool', async () => {
    await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bfam_id: 'BF1000' });

    const unlock = await request(app)
      .post('/admin/bfam-ids/BF1000/unlock')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(unlock.status).toBe(200);
    expect(reservationsTable).toHaveLength(0);

    const registerResponse = await request(app).post('/auth/register').send({
      phone_number: '+919876500098',
      password: 'SuperSecret123',
      role: 'PLAYER',
      waiver_accepted: true,
    });
    expect(registerResponse.body.bfam_id).toBe('BF1000');
  });

  it('manually assigns a locked BFAM ID to an existing player', async () => {
    const playerId = '11111111-1111-4111-8111-111111111111';
    usersTable.push({
      user_id: playerId,
      phone_number: '+919876500002',
      role: 'PLAYER',
      bfam_id: 'BF1005',
    });

    await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bfam_id: 'BF7' });

    const assign = await request(app)
      .post('/admin/bfam-ids/BF7/assign')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ user_id: playerId });

    expect(assign.status).toBe(200);
    expect(usersTable.find((u) => u.user_id === playerId)?.bfam_id).toBe('BF7');
    expect(reservationsTable[0].status).toBe('ASSIGNED');
    expect(reservationsTable[0].assigned_to_user_id).toBe(playerId);
  });

  it('rejects assigning a BFAM ID to a non-PLAYER account', async () => {
    const ownerId = '22222222-2222-4222-8222-222222222222';
    usersTable.push({
      user_id: ownerId,
      phone_number: '+919876500003',
      role: 'TURF_OWNER',
      bfam_id: null,
    });

    await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bfam_id: 'BF18' });

    const assign = await request(app)
      .post('/admin/bfam-ids/BF18/assign')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ user_id: ownerId });

    expect(assign.status).toBe(400);
  });

  it('lists reserved BFAM IDs', async () => {
    await request(app)
      .post('/admin/bfam-ids/lock')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bfam_id: 'BF99' });

    const list = await request(app)
      .get('/admin/bfam-ids')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].bfam_id).toBe('BF99');
  });
});
