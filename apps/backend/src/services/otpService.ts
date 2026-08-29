// Mocked OTP delivery: there is no SMS/email gateway in this project yet.
// "Sending" an OTP means generating a 6-digit code, storing it in an
// in-memory Map keyed by `${identifier}:${purpose}` with a short TTL
// (single-use, consumed on successful verify), logging it clearly to the
// console, and — only outside production — handing it back in the API
// response so the mobile app and tests can proceed without a real gateway.
// This follows the exact ephemeral-Map convention already used in
// services/pushNotificationService.ts for push tokens.

export type OtpPurpose = 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD';

interface StoredOtp {
  code: string;
  expiresAt: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;

const otpStore = new Map<string, StoredOtp>();

function otpKey(identifier: string, purpose: OtpPurpose) {
  return `${identifier.trim().toLowerCase()}:${purpose}`;
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generates and "sends" (mock: console.log only) an OTP for the given
 * identifier/purpose, overwriting any previous unconsumed OTP for that key.
 * Returns the raw code so the caller can decide whether to surface it in a
 * non-production API response (`dev_otp`) — this function never decides
 * that on its own, since some call sites (LOGIN/RESET_PASSWORD when no
 * matching user exists) intentionally skip generating one entirely to avoid
 * wasted state, while still returning a generic success response.
 */
export function generateAndSendOtp(identifier: string, purpose: OtpPurpose): string {
  const code = generateSixDigitCode();
  otpStore.set(otpKey(identifier, purpose), {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  console.log(`[MOCK OTP] ${identifier} (${purpose}): ${code}`);

  return code;
}

export type OtpVerifyResult = 'VALID' | 'INVALID' | 'EXPIRED' | 'NOT_FOUND';

/**
 * Verifies and consumes (single-use) an OTP. A correct code is deleted from
 * the store immediately whether or not it had expired, so it can never be
 * replayed.
 */
export function verifyAndConsumeOtp(
  identifier: string,
  purpose: OtpPurpose,
  code: string,
): OtpVerifyResult {
  const key = otpKey(identifier, purpose);
  const entry = otpStore.get(key);

  if (!entry) {
    return 'NOT_FOUND';
  }

  if (entry.code !== code) {
    return 'INVALID';
  }

  otpStore.delete(key);

  if (Date.now() > entry.expiresAt) {
    return 'EXPIRED';
  }

  return 'VALID';
}

// Test/dev-only helper to inspect store size without exposing codes.
export function _clearOtpStoreForTests() {
  otpStore.clear();
}
