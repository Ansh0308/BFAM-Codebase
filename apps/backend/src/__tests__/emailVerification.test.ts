// Exercises POST /profile/email/send-otp and /profile/email/verify-otp end
// to end through supertest. Only the low-level `sequelize` driver calls are
// faked (no real MySQL here), and `../services/emailService` is mocked so
// this never attempts a real Brevo SMTP connection — BREVO_SMTP_LOGIN/KEY
// are set in the real .env this test process loads via dotenv, so without
// this mock the "send" step would try to hit the real Brevo relay.

interface FakeUser {
  user_id: string;
  bfam_id: string | null;
  role: string;
  phone_number: string;
  email: string | null;
  email_verified_at: Date | null;
  profile_photo_url: string | null;
  city: string | null;
  preferred_language: string | null;
  deleted_at: Date | null;
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

let usersTable: FakeUser[] = [];
let otpCodesTable: FakeOtpRow[] = [];

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (sql: string, options: { replacements?: Record<string, unknown> } = {}) => {
        const r = options.replacements ?? {};

        if (sql.startsWith('DELETE FROM otp_codes WHERE identifier')) {
          otpCodesTable = otpCodesTable.filter(
            (row) =>
              !(
                row.identifier === r.identifier &&
                row.purpose === r.purpose &&
                row.consumed_at === null
              ),
          );
          return [{}];
        }
        if (sql.startsWith('INSERT INTO otp_codes')) {
          otpCodesTable.push({
            otp_id: r.otpId as string,
            identifier: r.identifier as string,
            purpose: r.purpose as string,
            code_hash: r.codeHash as string,
            expires_at: r.expiresAt as Date,
            consumed_at: null,
            created_at: r.now as Date,
          });
          return [{}];
        }
        if (sql.includes('SELECT otp_id, code_hash, expires_at FROM otp_codes')) {
          const matches = otpCodesTable
            .filter(
              (row) =>
                row.identifier === r.identifier &&
                row.purpose === r.purpose &&
                row.consumed_at === null,
            )
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
          return matches.length ? [matches[0]] : [];
        }
        if (sql.startsWith('UPDATE otp_codes SET consumed_at')) {
          const row = otpCodesTable.find((entry) => entry.otp_id === r.otpId);
          if (row) row.consumed_at = r.now as Date;
          return [{}];
        }
        if (
          sql.startsWith('SELECT user_id, bfam_id, role, phone_number, email, email_verified_at')
        ) {
          const user = usersTable.find((u) => u.user_id === r.userId && !u.deleted_at);
          return user ? [user] : [];
        }
        if (sql.startsWith('SELECT playing_role, batting_style')) {
          return [];
        }
        if (sql.startsWith('UPDATE users SET email = :email, email_verified_at')) {
          if (usersTable.some((u) => u.email === r.email && u.user_id !== r.userId)) {
            const dupError = new Error('Duplicate entry') as Error & {
              original?: { code?: string };
            };
            dupError.original = { code: 'ER_DUP_ENTRY' };
            throw dupError;
          }
          const user = usersTable.find((u) => u.user_id === r.userId);
          if (user) {
            user.email = r.email as string;
            user.email_verified_at = r.now as Date;
          }
          return [{}];
        }
        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
    },
  };
});

const mockSendEmailVerificationOtp = jest.fn();
jest.mock('../services/emailService', () => ({
  sendEmailVerificationOtp: (...args: unknown[]) => mockSendEmailVerificationOtp(...args),
}));

import request from 'supertest';
import app from '../app';
import { issueJwt } from '../services/authService';

describe('POST /profile/email/send-otp and /verify-otp', () => {
  beforeEach(() => {
    usersTable = [];
    otpCodesTable = [];
    mockSendEmailVerificationOtp.mockReset().mockResolvedValue({ deliveryError: null });
  });

  it('rejects an unauthenticated send-otp request', async () => {
    const response = await request(app).post('/profile/email/send-otp').send({ email: 'a@b.com' });
    expect(response.status).toBe(401);
  });

  it('rejects a malformed email', async () => {
    const token = issueJwt({ userId: 'p1', role: 'PLAYER', bfamId: 'BF1001' });
    const response = await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(mockSendEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('sends an OTP via email and returns dev_otp outside production', async () => {
    const token = issueJwt({ userId: 'p2', role: 'PLAYER', bfamId: 'BF1002' });
    const response = await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player@bfam.local' });

    expect(response.status).toBe(200);
    expect(response.body.dev_otp).toMatch(/^\d{6}$/);
    expect(mockSendEmailVerificationOtp).toHaveBeenCalledWith(
      'player@bfam.local',
      response.body.dev_otp,
    );
  });

  it('surfaces a real delivery failure via dev_email_error instead of hiding it', async () => {
    mockSendEmailVerificationOtp.mockResolvedValueOnce({
      deliveryError: 'Invalid login: 525 5.7.1 Unauthorized IP address',
    });

    const token = issueJwt({ userId: 'p2b', role: 'PLAYER', bfamId: 'BF1002' });
    const response = await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player2b@bfam.local' });

    expect(response.status).toBe(200);
    expect(response.body.dev_otp).toMatch(/^\d{6}$/);
    expect(response.body.dev_email_error).toMatch(/Unauthorized IP/);
  });

  it('verifies the OTP and persists the email as verified', async () => {
    usersTable.push({
      user_id: 'p3',
      bfam_id: 'BF1003',
      role: 'PLAYER',
      phone_number: '+919876500003',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    const token = issueJwt({ userId: 'p3', role: 'PLAYER', bfamId: 'BF1003' });

    const sendResponse = await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player3@bfam.local' });

    const verifyResponse = await request(app)
      .post('/profile/email/verify-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player3@bfam.local', otp: sendResponse.body.dev_otp });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.email).toBe('player3@bfam.local');
    expect(verifyResponse.body.email_verified_at).not.toBeNull();
  });

  it('rejects an incorrect code without verifying the email', async () => {
    usersTable.push({
      user_id: 'p4',
      bfam_id: 'BF1004',
      role: 'PLAYER',
      phone_number: '+919876500004',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    const token = issueJwt({ userId: 'p4', role: 'PLAYER', bfamId: 'BF1004' });

    await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player4@bfam.local' });

    const verifyResponse = await request(app)
      .post('/profile/email/verify-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player4@bfam.local', otp: '000000' });

    expect(verifyResponse.status).toBe(400);
    expect(usersTable[0].email).toBeNull();
  });

  it('rejects verifying an email already registered to another account', async () => {
    usersTable.push(
      {
        user_id: 'p5',
        bfam_id: 'BF1005',
        role: 'PLAYER',
        phone_number: '+919876500005',
        email: 'taken@bfam.local',
        email_verified_at: new Date(),
        profile_photo_url: null,
        city: null,
        preferred_language: 'en',
        deleted_at: null,
      },
      {
        user_id: 'p6',
        bfam_id: 'BF1006',
        role: 'PLAYER',
        phone_number: '+919876500006',
        email: null,
        email_verified_at: null,
        profile_photo_url: null,
        city: null,
        preferred_language: 'en',
        deleted_at: null,
      },
    );
    const token = issueJwt({ userId: 'p6', role: 'PLAYER', bfamId: 'BF1006' });

    const sendResponse = await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@bfam.local' });

    const verifyResponse = await request(app)
      .post('/profile/email/verify-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@bfam.local', otp: sendResponse.body.dev_otp });

    expect(verifyResponse.status).toBe(409);
  });

  it('a verified OTP cannot be replayed', async () => {
    usersTable.push({
      user_id: 'p7',
      bfam_id: 'BF1007',
      role: 'PLAYER',
      phone_number: '+919876500007',
      email: null,
      email_verified_at: null,
      profile_photo_url: null,
      city: null,
      preferred_language: 'en',
      deleted_at: null,
    });
    const token = issueJwt({ userId: 'p7', role: 'PLAYER', bfamId: 'BF1007' });

    const sendResponse = await request(app)
      .post('/profile/email/send-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player7@bfam.local' });

    await request(app)
      .post('/profile/email/verify-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player7@bfam.local', otp: sendResponse.body.dev_otp });

    const replay = await request(app)
      .post('/profile/email/verify-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'player7@bfam.local', otp: sendResponse.body.dev_otp });

    expect(replay.status).toBe(400);
  });
});
