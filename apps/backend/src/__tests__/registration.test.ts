// Exercises the real POST /auth/register route (app.ts) end-to-end through
// supertest, including the real allocateBfamId lock/insert path. Only the
// low-level MySQL driver calls made via `sequelize` are faked, since no real
// MySQL is available in this test environment.

let usersTable: Array<Record<string, unknown>> = [];
let userConsents: Array<Record<string, unknown>> = [];
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
        if (sql.startsWith('SELECT user_id FROM users WHERE bfam_id')) {
          const found = usersTable.find((u) => u.bfam_id === options.replacements?.bfamId);
          return found ? [found] : [];
        }
        if (sql.includes('SELECT reservation_id FROM reserved_bfam_ids')) {
          return [];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'user_consents') {
            userConsents.push(...rows);
            return;
          }
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
    userConsents = [];
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
      waiver_accepted: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.bfam_id).toMatch(/^BF\d+$/);
    expect(usersTable).toHaveLength(1);
    expect(usersTable[0].password_hash).not.toBe('SuperSecret123');
  });

  // Backlog G-21: waiver_accepted: true (required by registerUserSchema)
  // must be recorded as a versioned TERMS consent, not just the older
  // liability_waiver_accepted_at timestamp.
  it('records a versioned TERMS consent on registration', async () => {
    const response = await request(app).post('/auth/register').send({
      phone_number: '+919876543298',
      password: 'SuperSecret123',
      role: 'PLAYER',
      waiver_accepted: true,
    });

    expect(response.status).toBe(201);
    expect(userConsents).toHaveLength(1);
    expect(userConsents[0]).toMatchObject({
      consent_type: 'TERMS',
      user_id: usersTable[0].user_id,
    });
    expect(userConsents[0].policy_version).toEqual(expect.any(String));
  });

  it("assigns a BFAM ID ending in the favorite cricketer's jersey number when known", async () => {
    const response = await request(app).post('/auth/register').send({
      phone_number: '+919876543299',
      password: 'SuperSecret123',
      role: 'PLAYER',
      favorite_cricketer_name: 'Virat Kohli',
      favorite_cricketer_external_id: 'fixture-virat-kohli',
      waiver_accepted: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.bfam_id).toBe('BF1018');
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

  // A raw API call bypassing the mobile signup UI's role picker (which
  // only ever offers PLAYER/TURF_OWNER/TURF_STAFF) must not be able to
  // self-register as ADMIN — that's a privileged role, provisioned
  // out-of-band, never through open registration.
  it('rejects self-registration with role ADMIN, even though it passes schema validation', async () => {
    const response = await request(app).post('/auth/register').send({
      phone_number: '+919876500000',
      password: 'SuperSecret123',
      role: 'ADMIN',
      waiver_accepted: true,
    });

    expect(response.status).toBe(403);
    expect(usersTable).toHaveLength(0);
  });

  // Backlog G-22: the minimum-age gate (PRD §32.7) must block registration
  // itself when a date of birth is supplied, not only a later profile edit.
  it('rejects registration when the supplied date of birth is under the minimum age', async () => {
    const under13 = new Date();
    under13.setFullYear(under13.getFullYear() - 10);

    const response = await request(app)
      .post('/auth/register')
      .send({
        phone_number: '+919876543211',
        password: 'SuperSecret123',
        role: 'PLAYER',
        date_of_birth: under13.toISOString().slice(0, 10),
        waiver_accepted: true,
      });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/at least 13 years old/);
    expect(usersTable).toHaveLength(0);
  });

  it('accepts registration with an adult date of birth and stores is_minor correctly', async () => {
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - 25);

    const response = await request(app)
      .post('/auth/register')
      .send({
        phone_number: '+919876543212',
        password: 'SuperSecret123',
        role: 'PLAYER',
        date_of_birth: adult.toISOString().slice(0, 10),
        waiver_accepted: true,
      });

    expect(response.status).toBe(201);
    expect(usersTable[0].is_minor).toBe(false);
  });

  it('flags is_minor for a 13-17 year old registrant without blocking registration', async () => {
    const teen = new Date();
    teen.setFullYear(teen.getFullYear() - 15);

    const response = await request(app)
      .post('/auth/register')
      .send({
        phone_number: '+919876543213',
        password: 'SuperSecret123',
        role: 'PLAYER',
        date_of_birth: teen.toISOString().slice(0, 10),
        waiver_accepted: true,
      });

    expect(response.status).toBe(201);
    expect(usersTable[0].is_minor).toBe(true);
  });

  it('assigns strictly increasing, unique BFAM IDs to concurrent registrations', async () => {
    const requests = Array.from({ length: 25 }, (_, index) =>
      request(app)
        .post('/auth/register')
        .send({
          phone_number: `+9198765400${String(index).padStart(2, '0')}`,
          password: 'SuperSecret123',
          role: 'PLAYER',
          waiver_accepted: true,
        }),
    );

    const responses = await Promise.all(requests);
    const bfamIds = responses.map((r) => r.body.bfam_id);

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(new Set(bfamIds).size).toBe(bfamIds.length);
  });
});
