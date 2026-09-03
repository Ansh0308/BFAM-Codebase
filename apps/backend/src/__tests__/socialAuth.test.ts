// Exercises POST /auth/google, /auth/apple, and /auth/social/complete.
// Mocks google-auth-library's OAuth2Client.verifyIdToken and
// apple-signin-auth's verifyIdToken (no real Google/Apple credentials are
// available in this test environment), plus the low-level sequelize calls,
// the same way otpAuthFlows.test.ts and registration.test.ts do.

interface FakeUserRow {
  user_id: string;
  phone_number: string;
  email: string | null;
  password_hash: string;
  role: string;
  bfam_id: string;
  google_id: string | null;
  apple_id: string | null;
}

let usersTable: FakeUserRow[] = [];
let playersTable: Array<Record<string, unknown>> = [];
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
        const replacements = options.replacements ?? {};
        if (sql.includes('GET_LOCK')) {
          await acquireLock();
          return [{ locked: 1 }];
        }
        if (sql.includes('RELEASE_LOCK')) {
          releaseLock();
          return [{}];
        }
        if (sql.includes('MAX(CAST(SUBSTRING')) {
          const numbers = usersTable
            .filter((u) => typeof u.bfam_id === 'string')
            .map((u) => Number(String(u.bfam_id).replace('BF', '')));
          const max = numbers.length ? Math.max(...numbers) : null;
          return [{ max_id: max === null ? null : String(max) }];
        }
        if (sql.includes('SELECT reservation_id FROM reserved_bfam_ids')) {
          return [];
        }
        if (sql.includes('google_id = :providerId')) {
          const found = usersTable.find((u) => u.google_id === replacements.providerId);
          return found ? [found] : [];
        }
        if (sql.includes('apple_id = :providerId')) {
          const found = usersTable.find((u) => u.apple_id === replacements.providerId);
          return found ? [found] : [];
        }
        if (sql.includes('UPDATE users SET last_login_at')) {
          return [{}];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({}),
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'users') usersTable.push(...(rows as unknown as FakeUserRow[]));
          else if (table === 'players') playersTable.push(...rows);
        },
      }),
    },
  };
});

let googleVerifyResult: { sub: string; email?: string; name?: string } | null = null;
// Plain class (not jest.fn) so jest.config.js's global resetMocks/
// restoreMocks (which wipe mockImplementation between tests) can't clear it.
jest.mock('google-auth-library', () => {
  class FakeOAuth2Client {
    async verifyIdToken() {
      if (!googleVerifyResult) throw new Error('Invalid Google token');
      return { getPayload: () => googleVerifyResult };
    }
  }
  return { OAuth2Client: FakeOAuth2Client };
});

let appleVerifyResult: { sub: string; email?: string } | null = null;
jest.mock('apple-signin-auth', () => ({
  verifyIdToken: async () => {
    if (!appleVerifyResult) throw new Error('Invalid Apple token');
    return appleVerifyResult;
  },
}));

import request from 'supertest';
import app from '../app';

describe('Social auth (Google / Apple)', () => {
  beforeEach(() => {
    usersTable = [];
    playersTable = [];
    lockHeld = false;
    lockWaiters.length = 0;
    googleVerifyResult = null;
    appleVerifyResult = null;
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.APPLE_CLIENT_ID = 'test-apple-client-id';
  });

  it('returns a social ticket for a brand-new Google user, then completes signup', async () => {
    googleVerifyResult = {
      sub: 'google-uid-1',
      email: 'new.google.user@example.com',
      name: 'Nova',
    };

    const googleResponse = await request(app).post('/auth/google').send({ id_token: 'fake' });
    expect(googleResponse.status).toBe(200);
    expect(googleResponse.body.social_ticket).toEqual(expect.any(String));
    expect(googleResponse.body.email).toBe('new.google.user@example.com');

    const completeResponse = await request(app).post('/auth/social/complete').send({
      social_ticket: googleResponse.body.social_ticket,
      phone_number: '+919876500010',
      role: 'PLAYER',
      waiver_accepted: true,
    });

    expect(completeResponse.status).toBe(201);
    expect(usersTable).toHaveLength(1);
    expect(usersTable[0].google_id).toBe('google-uid-1');
    expect(usersTable[0].email).toBe('new.google.user@example.com');
    expect(playersTable).toHaveLength(1);
  });

  it('logs in an existing Google user with the same JWT shape as password login', async () => {
    usersTable.push({
      user_id: 'existing-1',
      phone_number: '+919876500011',
      email: 'existing.google@example.com',
      password_hash: 'hash',
      role: 'TURF_STAFF',
      bfam_id: 'BF2000',
      google_id: 'google-uid-2',
      apple_id: null,
    });
    googleVerifyResult = { sub: 'google-uid-2', email: 'existing.google@example.com' };

    const response = await request(app).post('/auth/google').send({ id_token: 'fake' });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.bfam_id).toBe('BF2000');
    expect(response.body.role).toBe('TURF_STAFF');
  });

  it('handles Apple sign-in when email is absent (non-first authorization)', async () => {
    appleVerifyResult = { sub: 'apple-uid-1' };

    const appleResponse = await request(app).post('/auth/apple').send({ identity_token: 'fake' });
    expect(appleResponse.status).toBe(200);
    expect(appleResponse.body.email).toBeNull();
    expect(appleResponse.body.social_ticket).toEqual(expect.any(String));

    const completeResponse = await request(app).post('/auth/social/complete').send({
      social_ticket: appleResponse.body.social_ticket,
      phone_number: '+919876500012',
      role: 'TURF_OWNER',
      waiver_accepted: true,
    });
    expect(completeResponse.status).toBe(201);
    expect(usersTable[0].apple_id).toBe('apple-uid-1');
    expect(usersTable[0].email).toBeNull();
    // TURF_OWNER never gets a players row.
    expect(playersTable).toHaveLength(0);
  });

  it('rejects /auth/social/complete with a tampered/invalid ticket', async () => {
    const response = await request(app).post('/auth/social/complete').send({
      social_ticket: 'not-a-real-ticket',
      phone_number: '+919876500013',
      role: 'PLAYER',
      waiver_accepted: true,
    });
    expect(response.status).toBe(401);
  });

  it('rejects /auth/social/complete role=ADMIN (self-service signup never allows ADMIN)', async () => {
    googleVerifyResult = { sub: 'google-uid-3', email: 'admin.try@example.com' };
    const googleResponse = await request(app).post('/auth/google').send({ id_token: 'fake' });

    const response = await request(app).post('/auth/social/complete').send({
      social_ticket: googleResponse.body.social_ticket,
      phone_number: '+919876500014',
      role: 'ADMIN',
      waiver_accepted: true,
    });
    expect(response.status).toBe(400);
  });
});
