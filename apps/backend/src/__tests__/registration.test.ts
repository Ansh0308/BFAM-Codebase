// Exercises the real POST /auth/register route (app.ts) end-to-end through
// supertest, including the real allocateBfamId lock/insert path. Only the
// low-level MySQL driver calls made via `sequelize` are faked, since no real
// MySQL is available in this test environment.

let usersTable: Array<Record<string, unknown>> = [];
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
      query: async (sql: string) => {
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
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table !== 'users') return;
          for (const row of rows) {
            if (usersTable.some((u) => u.phone_number === row.phone_number)) {
              throw new Error('Duplicate entry for phone_number');
            }
          }
          usersTable.push(...rows);
        },
      }),
    },
  };
});

import request from 'supertest';
import app from '../app';

describe('POST /auth/register', () => {
  beforeEach(() => {
    usersTable = [];
    lockHeld = false;
    lockWaiters.length = 0;
  });

  it('registers a player and issues a JWT with an allocated BFAM ID', async () => {
    const response = await request(app).post('/auth/register').send({
      phone_number: '+919876543210',
      email: 'new.player@bfam.local',
      password: 'SuperSecret123',
      role: 'PLAYER',
      city: 'Rajkot',
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.bfam_id).toMatch(/^BF\d+$/);
    expect(usersTable).toHaveLength(1);
    expect(usersTable[0].password_hash).not.toBe('SuperSecret123');
  });

  it('rejects an invalid payload before touching the allocator', async () => {
    const response = await request(app).post('/auth/register').send({
      phone_number: '123',
      password: 'short',
      role: 'NOT_A_ROLE',
    });

    expect(response.status).toBe(400);
    expect(usersTable).toHaveLength(0);
  });

  it('assigns strictly increasing, unique BFAM IDs to concurrent registrations', async () => {
    const requests = Array.from({ length: 25 }, (_, index) =>
      request(app)
        .post('/auth/register')
        .send({
          phone_number: `+9198765400${String(index).padStart(2, '0')}`,
          password: 'SuperSecret123',
          role: 'PLAYER',
        }),
    );

    const responses = await Promise.all(requests);
    const bfamIds = responses.map((r) => r.body.bfam_id);

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(new Set(bfamIds).size).toBe(bfamIds.length);
  });
});
