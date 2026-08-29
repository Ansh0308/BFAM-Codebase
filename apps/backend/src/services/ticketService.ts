// Short-lived, purpose-scoped JWTs used as intermediate "tickets" between
// multi-step auth flows (OTP-verify -> register, social-verify -> phone
// collection -> social/complete, forgot-password -> reset-password).
//
// These are deliberately NOT full auth tokens (see services/authService.ts
// issueJwt/verifyJwt): they carry a `purpose` claim that is strictly
// checked on consumption, a short (~15 min) expiry, and never a `scopes`
// array — so a leaked ticket can't be used to call authenticated routes.

import jwt from 'jsonwebtoken';

const TICKET_TTL = '15m';
const defaultSecret = 'bfam-phase1-local-secret';

function secret() {
  return process.env.JWT_SECRET || defaultSecret;
}

export type TicketPurpose = 'signup_verified' | 'reset_verified' | 'social_verified';

export interface SignupTicketPayload {
  purpose: 'signup_verified';
  identifier: string;
}

export interface ResetTicketPayload {
  purpose: 'reset_verified';
  identifier: string;
}

export interface SocialTicketPayload {
  purpose: 'social_verified';
  provider: 'google' | 'apple';
  google_id?: string;
  apple_id?: string;
  email?: string | null;
  name?: string | null;
}

export type TicketPayload = SignupTicketPayload | ResetTicketPayload | SocialTicketPayload;

export function issueSignupTicket(identifier: string): string {
  const payload: SignupTicketPayload = { purpose: 'signup_verified', identifier };
  return jwt.sign(payload, secret(), { expiresIn: TICKET_TTL });
}

export function issueResetTicket(identifier: string): string {
  const payload: ResetTicketPayload = { purpose: 'reset_verified', identifier };
  return jwt.sign(payload, secret(), { expiresIn: TICKET_TTL });
}

export function issueSocialTicket(input: Omit<SocialTicketPayload, 'purpose'>): string {
  const payload: SocialTicketPayload = { purpose: 'social_verified', ...input };
  return jwt.sign(payload, secret(), { expiresIn: TICKET_TTL });
}

/**
 * Verifies a ticket and asserts it carries the expected purpose. Throws on
 * any failure (invalid signature, expired, wrong/missing purpose) — callers
 * should catch and translate to a 401.
 */
export function verifyTicket<P extends TicketPayload['purpose']>(
  token: string,
  expectedPurpose: P,
): Extract<TicketPayload, { purpose: P }> {
  const decoded = jwt.verify(token, secret()) as TicketPayload;
  if (decoded.purpose !== expectedPurpose) {
    throw new Error('Invalid ticket purpose');
  }
  return decoded as Extract<TicketPayload, { purpose: P }>;
}
