// Exercises the OTP-based signup/login/reset-password flows end-to-end
// through supertest (app.ts), the same way registration.test.ts exercises
// /auth/register: only the low-level MySQL driver calls made via
// `sequelize` are faked (no real MySQL in this test run), while every
// production code path (otpService, ticketService, accountService,
// bfamIdAllocator) runs for real.

interface FakeUserRow {
  user_id: string;
  phone_number: string;
  email: string | null;
  password_hash: string;
  role: string;
  bfam_id: string;
  google_id: string | null;
  apple_id: string | null;
  phone_verified_at: Date | null;
  last_login_at: Date | null;
}

interface FakeOtpRow {
  otp_id: string;
  identifier: string;
  purpose: string;
  code_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

let usersTable: FakeUserRow[] = [];
let playersTable: Array<Record<string, unknown>> = [];
let otpCodesTable: FakeOtpRow[] = [];
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
        if (sql.startsWith('SELECT user_id FROM users WHERE bfam_id')) {
          const found = usersTable.find((u) => u.bfam_id === replacements.bfamId);
          return found ? [found] : [];
        }
        if (sql.includes('SELECT') && sql.includes('WHERE (phone_number')) {
          const identifier = replacements.identifier as string;
          const found = usersTable.find(
            (u) => u.phone_number === identifier || u.email === identifier,
          );
          return found ? [found] : [];
        }
        if (sql.includes('SELECT') && sql.includes('google_id = :providerId')) {
          const found = usersTable.find((u) => u.google_id === replacements.providerId);
          return found ? [found] : [];
        }
        if (sql.includes('SELECT') && sql.includes('apple_id = :providerId')) {
          const found = usersTable.find((u) => u.apple_id === replacements.providerId);
          return found ? [found] : [];
        }
        if (sql.includes('UPDATE users SET last_login_at')) {
          const user = usersTable.find((u) => u.user_id === replacements.userId);
          if (user) user.last_login_at = replacements.now as Date;
          return [{}];
        }
        if (sql.includes('UPDATE users SET password_hash')) {
          const user = usersTable.find((u) => u.user_id === replacements.userId);
          if (user) user.password_hash = replacements.passwordHash as string;
          return [{}];
        }
        if (sql.startsWith('DELETE FROM otp_codes WHERE identifier')) {
          otpCodesTable = otpCodesTable.filter(
            (row) =>
              !(
                row.identifier === replacements.identifier &&
                row.purpose === replacements.purpose &&
                row.consumed_at === null
              ),
          );
          return [{}];
        }
        if (sql.startsWith('DELETE FROM otp_codes')) {
          otpCodesTable = [];
          return [{}];
        }
        if (sql.startsWith('INSERT INTO otp_codes')) {
          otpCodesTable.push({
            otp_id: replacements.otpId as string,
            identifier: replacements.identifier as string,
            purpose: replacements.purpose as string,
            code_hash: replacements.codeHash as string,
            expires_at: replacements.expiresAt as Date,
            consumed_at: null,
            created_at: replacements.now as Date,
          });
          return [{}];
        }
        if (sql.includes('SELECT otp_id, code_hash, expires_at FROM otp_codes')) {
          const matches = otpCodesTable
            .filter(
              (row) =>
                row.identifier === replacements.identifier &&
                row.purpose === replacements.purpose &&
                row.consumed_at === null,
            )
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
          return matches.length ? [matches[0]] : [];
        }
        if (sql.startsWith('UPDATE otp_codes SET consumed_at')) {
          const row = otpCodesTable.find((r) => r.otp_id === replacements.otpId);
          if (row) row.consumed_at = replacements.now as Date;
          return [{}];
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
            usersTable.push(...(rows as unknown as FakeUserRow[]));
          } else if (table === 'players') {
            playersTable.push(...rows);
          }
        },
      }),
    },
  };
});

import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../app';
import { _clearOtpStoreForTests } from '../services/otpService';

describe('OTP-based signup / login / forgot-password flows', () => {
  beforeEach(async () => {
    usersTable = [];
    playersTable = [];
    otpCodesTable = [];
    lockHeld = false;
    lockWaiters.length = 0;
    await _clearOtpStoreForTests();
  });

  it('completes SIGNUP: send -> verify -> register with a phone_verified_at set and a players row', async () => {
    const identifier = '+919876500001';

    const sendResponse = await request(app)
      .post('/auth/otp/send')
      .send({ identifier, purpose: 'SIGNUP' });
    expect(sendResponse.status).toBe(200);
    expect(sendResponse.body.dev_otp).toMatch(/^\d{6}$/);

    const verifyResponse = await request(app)
      .post('/auth/otp/verify')
      .send({ identifier, otp: sendResponse.body.dev_otp, purpose: 'SIGNUP' });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.signup_token).toEqual(expect.any(String));

    // OTP is single-use — replay must fail.
    const replay = await request(app)
      .post('/auth/otp/verify')
      .send({ identifier, otp: sendResponse.body.dev_otp, purpose: 'SIGNUP' });
    expect(replay.status).toBe(400);

    const registerResponse = await request(app).post('/auth/register').send({
      phone_number: identifier,
      password: 'SuperSecret123',
      role: 'PLAYER',
      signup_token: verifyResponse.body.signup_token,
      favorite_cricketer_name: 'Virat Kohli',
      favorite_cricketer_external_id: 'fixture-virat-kohli',
    });

    expect(registerResponse.status).toBe(201);
    expect(usersTable).toHaveLength(1);
    expect(usersTable[0].phone_verified_at).not.toBeNull();
    expect(playersTable).toHaveLength(1);
    expect(playersTable[0].favorite_cricketer_name).toBe('Virat Kohli');
  });

  it('rejects SIGNUP OTP send for an identifier that already has an account', async () => {
    usersTable.push({
      user_id: 'u1',
      phone_number: '+919876500002',
      email: null,
      password_hash: 'hash',
      role: 'PLAYER',
      bfam_id: 'BF1000',
      google_id: null,
      apple_id: null,
      phone_verified_at: null,
      last_login_at: null,
    });

    const response = await request(app)
      .post('/auth/otp/send')
      .send({ identifier: '+919876500002', purpose: 'SIGNUP' });
    expect(response.status).toBe(409);
  });

  it('does not leak account existence for LOGIN/RESET_PASSWORD OTP sends', async () => {
    const unknown = await request(app)
      .post('/auth/otp/send')
      .send({ identifier: '+919000000000', purpose: 'LOGIN' });
    const known = await request(app)
      .post('/auth/otp/send')
      .send({ identifier: '+919000000000', purpose: 'LOGIN' });

    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    // Neither response discloses existence via status/shape; dev_otp is only
    // present when a matching account actually existed.
    expect(unknown.body.dev_otp).toBeUndefined();
  });

  it('completes LOGIN via OTP for an existing user, issuing the same JWT shape as password login', async () => {
    usersTable.push({
      user_id: 'u2',
      phone_number: '+919876500003',
      email: null,
      password_hash: 'hash',
      role: 'TURF_OWNER',
      bfam_id: 'BF1001',
      google_id: null,
      apple_id: null,
      phone_verified_at: null,
      last_login_at: null,
    });

    const sendResponse = await request(app)
      .post('/auth/otp/send')
      .send({ identifier: '+919876500003', purpose: 'LOGIN' });
    expect(sendResponse.body.dev_otp).toMatch(/^\d{6}$/);

    const verifyResponse = await request(app)
      .post('/auth/otp/verify')
      .send({ identifier: '+919876500003', otp: sendResponse.body.dev_otp, purpose: 'LOGIN' });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.token).toEqual(expect.any(String));
    expect(verifyResponse.body.bfam_id).toBe('BF1001');
    expect(verifyResponse.body.role).toBe('TURF_OWNER');
  });

  it('completes the forgot-password -> reset-password flow', async () => {
    usersTable.push({
      user_id: 'u3',
      phone_number: '+919876500004',
      email: null,
      password_hash: 'old-hash',
      role: 'PLAYER',
      bfam_id: 'BF1002',
      google_id: null,
      apple_id: null,
      phone_verified_at: null,
      last_login_at: null,
    });

    const forgotResponse = await request(app)
      .post('/auth/forgot-password')
      .send({ identifier: '+919876500004' });
    expect(forgotResponse.status).toBe(200);
    expect(forgotResponse.body.dev_otp).toMatch(/^\d{6}$/);

    const verifyResponse = await request(app).post('/auth/otp/verify').send({
      identifier: '+919876500004',
      otp: forgotResponse.body.dev_otp,
      purpose: 'RESET_PASSWORD',
    });
    expect(verifyResponse.body.reset_token).toEqual(expect.any(String));

    const resetResponse = await request(app).post('/auth/reset-password').send({
      reset_token: verifyResponse.body.reset_token,
      new_password: 'BrandNewPassword123',
    });
    expect(resetResponse.status).toBe(200);
    expect(usersTable[0].password_hash).not.toBe('old-hash');
  });

  it('rejects reset-password with an invalid/expired ticket', async () => {
    const response = await request(app)
      .post('/auth/reset-password')
      .send({ reset_token: 'not-a-real-token', new_password: 'BrandNewPassword123' });
    expect(response.status).toBe(401);
  });

  it('logs in with the correct password and rejects the wrong one generically', async () => {
    usersTable.push({
      user_id: 'u4',
      phone_number: '+919876500005',
      email: null,
      password_hash: await bcrypt.hash('CorrectHorseBattery1', 10),
      role: 'PLAYER',
      bfam_id: 'BF1003',
      google_id: null,
      apple_id: null,
      phone_verified_at: null,
      last_login_at: null,
    });

    const good = await request(app)
      .post('/auth/login')
      .send({ identifier: '+919876500005', password: 'CorrectHorseBattery1' });
    expect(good.status).toBe(200);
    expect(good.body.token).toEqual(expect.any(String));

    const badPassword = await request(app)
      .post('/auth/login')
      .send({ identifier: '+919876500005', password: 'WrongPassword' });
    const unknownIdentifier = await request(app)
      .post('/auth/login')
      .send({ identifier: '+919000000099', password: 'WrongPassword' });

    expect(badPassword.status).toBe(401);
    expect(unknownIdentifier.status).toBe(401);
    expect(badPassword.body.error.message).toBe(unknownIdentifier.body.error.message);
  });
});
