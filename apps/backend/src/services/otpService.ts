import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { sendOtpSms } from './smsService';
import { sendEmailVerificationOtp } from './emailService';

// OTP state lives in MySQL (otp_codes table, migration
// 20260829090000-otp-codes-table.ts) rather than an in-memory Map — a Map
// is wiped on every restart/deploy and can't be shared across more than one
// backend instance, both fatal for production. Codes are stored bcrypt-
// hashed, same pattern as password_hash elsewhere in this codebase.

// EMAIL_VERIFY (added 2026-08-30) is a distinct purpose from
// SIGNUP/LOGIN/RESET_PASSWORD's SMS-based delivery — it's always delivered
// by email (see generateAndSendOtp below), used only by the authenticated
// "add/verify an email on your profile" flow.
export type OtpPurpose = 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD' | 'EMAIL_VERIFY';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_HASH_ROUNDS = 10;

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generates, stores (hashed), and sends an OTP for the given
 * identifier/purpose. Any previous unconsumed codes for the same
 * identifier+purpose are deleted first — both to enforce single-active-code
 * semantics and to keep the table from accumulating stale rows.
 *
 * Returns the raw code so the caller can decide whether to surface it in a
 * non-production API response (`dev_otp`) — this function never decides
 * that on its own, since some call sites (LOGIN/RESET_PASSWORD when no
 * matching user exists) intentionally skip generating one entirely to avoid
 * wasted state, while still returning a generic success response.
 *
 * Also returns `deliveryError` — non-null only for EMAIL_VERIFY when Brevo
 * is configured but the real send still failed outside production (see
 * emailService.ts) — so a caller can surface *why* delivery silently didn't
 * happen instead of the OTP just seeming to vanish. Always null for
 * SMS-delivered purposes.
 */
export async function generateAndSendOtp(
  identifier: string,
  purpose: OtpPurpose,
): Promise<{ code: string; deliveryError: string | null }> {
  const normalized = normalizeIdentifier(identifier);
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, OTP_HASH_ROUNDS);
  const now = new Date();

  await sequelize.query(
    'DELETE FROM otp_codes WHERE identifier = :identifier AND purpose = :purpose AND consumed_at IS NULL',
    { replacements: { identifier: normalized, purpose }, type: QueryTypes.DELETE },
  );

  await sequelize.query(
    `INSERT INTO otp_codes (otp_id, identifier, purpose, code_hash, expires_at, consumed_at, created_at)
     VALUES (:otpId, :identifier, :purpose, :codeHash, :expiresAt, NULL, :now)`,
    {
      replacements: {
        otpId: randomUUID(),
        identifier: normalized,
        purpose,
        codeHash,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        now,
      },
      type: QueryTypes.INSERT,
    },
  );

  let deliveryError: string | null = null;
  if (purpose === 'EMAIL_VERIFY') {
    ({ deliveryError } = await sendEmailVerificationOtp(identifier, code));
  } else {
    await sendOtpSms(identifier, code, purpose);
  }

  return { code, deliveryError };
}

export type OtpVerifyResult = 'VALID' | 'INVALID' | 'EXPIRED' | 'NOT_FOUND';

interface OtpRow {
  otp_id: string;
  code_hash: string;
  expires_at: Date;
}

/**
 * Verifies and consumes (single-use) an OTP. A correct code is marked
 * consumed immediately whether or not it had expired, so it can never be
 * replayed.
 */
export async function verifyAndConsumeOtp(
  identifier: string,
  purpose: OtpPurpose,
  code: string,
): Promise<OtpVerifyResult> {
  const normalized = normalizeIdentifier(identifier);

  const rows = await sequelize.query<OtpRow>(
    `SELECT otp_id, code_hash, expires_at FROM otp_codes
     WHERE identifier = :identifier AND purpose = :purpose AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    { replacements: { identifier: normalized, purpose }, type: QueryTypes.SELECT },
  );
  const entry = rows[0];

  if (!entry) {
    return 'NOT_FOUND';
  }

  const matches = await bcrypt.compare(code, entry.code_hash);
  if (!matches) {
    return 'INVALID';
  }

  await sequelize.query('UPDATE otp_codes SET consumed_at = :now WHERE otp_id = :otpId', {
    replacements: { now: new Date(), otpId: entry.otp_id },
    type: QueryTypes.UPDATE,
  });

  if (new Date() > new Date(entry.expires_at)) {
    return 'EXPIRED';
  }

  return 'VALID';
}

// Test/dev-only helper to reset OTP state between tests.
export async function _clearOtpStoreForTests(): Promise<void> {
  await sequelize.query('DELETE FROM otp_codes', { type: QueryTypes.DELETE });
}
