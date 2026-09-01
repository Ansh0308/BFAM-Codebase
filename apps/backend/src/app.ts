import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import * as Sentry from '@sentry/node';
import { initSentry } from './config/sentry';
import { USER_ROLES } from './domain/constants';
import { authenticateJwt, requireRoles } from './middleware/auth';
import { issueJwt, UserRole } from './services/authService';
import { createUserAccount } from './services/accountService';
import { sequelize } from './config/sequelize';
import {
  registerUserSchema,
  lockBfamIdSchema,
  assignBfamIdSchema,
  updateProfileSchema,
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  otpSendSchema,
  otpVerifySchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
  appleAuthSchema,
  socialCompleteSchema,
} from './validation/schemas';
import { generateAndSendOtp, verifyAndConsumeOtp, OtpPurpose } from './services/otpService';
import {
  issueSignupTicket,
  issueResetTicket,
  issueSocialTicket,
  verifyTicket,
} from './services/ticketService';
import { verifyGoogleIdToken, verifyAppleIdentityToken } from './services/socialAuthService';
import { searchCricketers } from './services/cricketerSearchService';
import {
  lockBfamId,
  unlockBfamId,
  assignBfamId,
  listReservedBfamIds,
  AdminBfamIdError,
} from './services/adminBfamIdService';
import {
  getMyProfile,
  updateMyProfile,
  setVerifiedEmail,
  DuplicateEmailError,
} from './services/profileService';
import {
  isS3Configured,
  isAllowedImageContentType,
  uploadProfilePhoto,
} from './services/uploadService';
import {
  persistRazorpayWebhookEvent,
  verifyRazorpayWebhookSignature,
} from './services/razorpayService';
import { confirmGatewayPayment } from './services/paymentService';
import {
  GatewayNotConfiguredError,
  InvalidWebhookSignatureError,
  PaymentNotFoundError,
} from './domain/errors';
import { registerExpoPushToken } from './services/pushNotificationService';
import turfsRouter from './routes/turfs';
import bookingsRouter from './routes/bookings';
import paymentsRouter from './routes/payments';
import teamsRouter from './routes/teams';
import matchesRouter from './routes/matches';

interface UserRow {
  user_id: string;
  phone_number: string;
  email: string | null;
  password_hash: string;
  role: UserRole;
  bfam_id: string | null;
  google_id: string | null;
  apple_id: string | null;
}

async function findUserByIdentifier(identifier: string): Promise<UserRow | null> {
  const rows = await sequelize.query<UserRow>(
    'SELECT user_id, phone_number, email, password_hash, role, bfam_id, google_id, apple_id FROM users WHERE (phone_number = :identifier OR email = :identifier) AND deleted_at IS NULL LIMIT 1',
    { replacements: { identifier }, type: QueryTypes.SELECT },
  );
  return rows[0] ?? null;
}

async function findUserBySocialId(
  column: 'google_id' | 'apple_id',
  providerId: string,
): Promise<UserRow | null> {
  const rows = await sequelize.query<UserRow>(
    `SELECT user_id, phone_number, email, password_hash, role, bfam_id, google_id, apple_id FROM users WHERE ${column} = :providerId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { providerId }, type: QueryTypes.SELECT },
  );
  return rows[0] ?? null;
}

async function touchLastLogin(userId: string): Promise<void> {
  await sequelize.query(
    'UPDATE users SET last_login_at = :now, updated_at = :now WHERE user_id = :userId',
    {
      replacements: { now: new Date(), userId },
      type: QueryTypes.UPDATE,
    },
  );
}

// Initialize Sentry before anything else
initSentry();

// A predictable JWT secret would let anyone forge auth tokens — refusing to
// boot in production without a real one beats silently running insecurely.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const app = express();

// Standard middlewares
app.use(helmet());
app.use(
  cors({
    // CORS_ORIGIN is a comma-separated allowlist (e.g.
    // "https://app.bfam.com,https://staging.bfam.com"). Unset = allow all,
    // which is fine for local dev but must be set before going to
    // production.
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  }),
);
// `verify` stashes the raw request bytes on req.rawBody alongside the
// parsed req.body — the Razorpay webhook handler needs the exact raw bytes
// to verify the HMAC signature (re-serializing req.body would not
// necessarily byte-match what Razorpay actually signed).
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);

// Auth endpoints are the highest-value brute-force/spam target (password
// guessing, OTP guessing/flooding) — a tighter limit than the rest of the
// API. Registration gets its own, more generous limiter: it's not a
// guessing attack surface the way login/OTP are, and legitimate concurrent
// signups (e.g. many users signing up around the same time) shouldn't
// collide with a limit sized for brute-force protection.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later', status: 429 } },
});
const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later', status: 429 } },
});
app.use(
  [
    '/auth/login',
    '/auth/otp/send',
    '/auth/otp/verify',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/profile/email/send-otp',
    '/profile/email/verify-otp',
  ],
  authRateLimiter,
);
app.use('/auth/register', registerRateLimiter);

// Sentry request handler (if DSN was configured, Sentry will capture HTTP requests)
// In newer Sentry Node SDK (v8+), Sentry.setupExpressErrorHandler(app) is typically used.
// Let's implement v8 compatibility: Sentry.setupExpressErrorHandler(app) must be called after the routes.
// We'll wrap our routing and errors accordingly.

// Health check endpoint (for CI, ECS, and docker monitoring)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// A test error endpoint to verify Sentry
app.get('/debug-sentry', (_req: Request, _res: Response) => {
  throw new Error('Sentry test error from BFAM backend!');
});

// Main routes placeholder
app.get('/', (req: Request, res: Response) => {
  res.send('BFAM Backend API is active');
});

// Real registration flow: validates input, hashes the password, atomically
// allocates a BFAM ID and inserts the `users` row while the allocator lock
// is held (see services/bfamIdAllocator.ts), then issues a JWT. Satisfies
// PRD §12.59 ("BFAM ID issued automatically at registration"). No email/OTP
// verification or OAuth — out of scope for this phase.
app.post('/auth/register', async (req: Request, res: Response) => {
  const parsed = registerUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid registration payload',
        status: 400,
        details: parsed.error.flatten(),
      },
    });
  }

  const { password, signup_token, ...profile } = parsed.data;

  // If a signup ticket (from POST /auth/otp/verify, purpose=SIGNUP) was
  // supplied, it must be valid AND match the identifier being registered —
  // otherwise a verified-phone claim could be replayed against a different
  // phone/email. Verified separately from account creation so any ticket
  // failure (invalid signature, expired, wrong purpose, mismatched
  // identifier) always yields a clean 401 rather than a generic 409.
  let phoneVerified = false;
  if (signup_token) {
    try {
      const ticket = verifyTicket(signup_token, 'signup_verified');
      const identifierMatches =
        ticket.identifier === profile.phone_number || ticket.identifier === profile.email;
      if (!identifierMatches) {
        throw new Error('Signup ticket does not match the supplied identifier');
      }
      // Only phone_number has a verified_at column in the schema — an
      // email-purpose ticket is still validated above but does not set it.
      phoneVerified = ticket.identifier === profile.phone_number;
    } catch {
      return res
        .status(401)
        .json({ error: { message: 'Invalid or expired signup ticket', status: 401 } });
    }
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { userId, bfamId } = await createUserAccount({
      phoneNumber: profile.phone_number,
      email: profile.email,
      passwordHash,
      role: profile.role,
      city: profile.city,
      preferredLanguage: profile.preferred_language,
      phoneVerified,
      favoriteCricketerName: profile.favorite_cricketer_name,
      favoriteCricketerExternalId: profile.favorite_cricketer_external_id,
    });

    const token = issueJwt({ userId, role: profile.role, bfamId });
    return res.status(201).json({ token, user_id: userId, bfam_id: bfamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return res.status(409).json({ error: { message, status: 409 } });
  }
});

// POST /auth/otp/send — generates and (mock) "sends" an OTP for SIGNUP,
// LOGIN, or RESET_PASSWORD. Never leaks whether an identifier maps to an
// existing account via the response shape (LOGIN/RESET_PASSWORD always
// return the same generic 200 whether or not a user exists) — but an OTP is
// only actually generated/stored/logged when it could plausibly be used
// (SIGNUP: identifier must be free; LOGIN/RESET_PASSWORD: identifier must
// already belong to a user). `dev_otp` is only ever included outside
// production.
app.post('/auth/otp/send', async (req: Request, res: Response) => {
  const parsed = otpSendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: 'Invalid OTP request', status: 400, details: parsed.error.flatten() },
    });
  }

  const { identifier, purpose } = parsed.data as { identifier: string; purpose: OtpPurpose };

  try {
    const existingUser = await findUserByIdentifier(identifier);

    if (purpose === 'SIGNUP') {
      if (existingUser) {
        return res.status(409).json({
          error: { message: 'An account already exists for this identifier', status: 409 },
        });
      }
      const { code } = await generateAndSendOtp(identifier, purpose);
      return res.status(200).json({
        message: 'OTP sent',
        ...(process.env.NODE_ENV !== 'production' ? { dev_otp: code } : {}),
      });
    }

    // LOGIN / RESET_PASSWORD: generic response regardless of existence, but
    // only actually generate an OTP when there is a matching account.
    let devOtp: string | undefined;
    if (existingUser) {
      ({ code: devOtp } = await generateAndSendOtp(identifier, purpose));
    }
    return res.status(200).json({
      message: 'If an account exists for this identifier, an OTP has been sent',
      ...(process.env.NODE_ENV !== 'production' && devOtp ? { dev_otp: devOtp } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return res.status(500).json({ error: { message, status: 500 } });
  }
});

// POST /auth/otp/verify — validates and consumes (single-use) an OTP, then
// branches by purpose: SIGNUP -> signup ticket (account not yet created);
// LOGIN -> full auth JWT (same issueJwt/shape as password login); RESET_
// PASSWORD -> reset ticket (password not yet changed).
app.post('/auth/otp/verify', async (req: Request, res: Response) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid OTP verification request',
        status: 400,
        details: parsed.error.flatten(),
      },
    });
  }

  const { identifier, otp, purpose } = parsed.data as {
    identifier: string;
    otp: string;
    purpose: OtpPurpose;
  };

  try {
    const result = await verifyAndConsumeOtp(identifier, purpose, otp);
    if (result !== 'VALID') {
      return res.status(400).json({
        error: {
          message: `OTP is ${result === 'NOT_FOUND' ? 'not found or already used' : result.toLowerCase()}`,
          status: 400,
        },
      });
    }

    if (purpose === 'SIGNUP') {
      const signupTicket = issueSignupTicket(identifier);
      return res.status(200).json({ signup_token: signupTicket });
    }

    if (purpose === 'RESET_PASSWORD') {
      const resetTicket = issueResetTicket(identifier);
      return res.status(200).json({ reset_token: resetTicket });
    }

    // purpose === 'LOGIN'
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res
        .status(404)
        .json({ error: { message: 'No account found for this identifier', status: 404 } });
    }
    await touchLastLogin(user.user_id);
    const token = issueJwt({ userId: user.user_id, role: user.role, bfamId: user.bfam_id });
    return res
      .status(200)
      .json({ token, user_id: user.user_id, bfam_id: user.bfam_id, role: user.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OTP verification failed';
    return res.status(500).json({ error: { message, status: 500 } });
  }
});

// POST /auth/login — password login. Generic 401 on any failure (unknown
// identifier or wrong password) so failures never disclose which part was
// wrong.
app.post('/auth/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: 'Invalid login payload', status: 400, details: parsed.error.flatten() },
    });
  }

  const { identifier, password } = parsed.data;

  try {
    const user = await findUserByIdentifier(identifier);
    const genericFailure = () =>
      res.status(401).json({ error: { message: 'Invalid identifier or password', status: 401 } });

    if (!user) {
      return genericFailure();
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return genericFailure();
    }

    await touchLastLogin(user.user_id);
    const token = issueJwt({ userId: user.user_id, role: user.role, bfamId: user.bfam_id });
    return res
      .status(200)
      .json({ token, user_id: user.user_id, bfam_id: user.bfam_id, role: user.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(500).json({ error: { message, status: 500 } });
  }
});

// POST /auth/forgot-password — triggers the same OTP-send flow as
// purpose=RESET_PASSWORD, always returning the same generic response.
app.post('/auth/forgot-password', async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: 'Invalid request', status: 400, details: parsed.error.flatten() },
    });
  }

  const { identifier } = parsed.data;

  try {
    const existingUser = await findUserByIdentifier(identifier);
    let devOtp: string | undefined;
    if (existingUser) {
      ({ code: devOtp } = await generateAndSendOtp(identifier, 'RESET_PASSWORD'));
    }
    return res.status(200).json({
      message: 'If an account exists for this identifier, a password reset OTP has been sent',
      ...(process.env.NODE_ENV !== 'production' && devOtp ? { dev_otp: devOtp } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return res.status(500).json({ error: { message, status: 500 } });
  }
});

// POST /auth/reset-password — consumes a reset ticket (from
// /auth/otp/verify, purpose=RESET_PASSWORD) and sets a new password_hash.
app.post('/auth/reset-password', async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid reset-password payload',
        status: 400,
        details: parsed.error.flatten(),
      },
    });
  }

  const { reset_token, new_password } = parsed.data;

  try {
    const ticket = verifyTicket(reset_token, 'reset_verified');
    const user = await findUserByIdentifier(ticket.identifier);
    if (!user) {
      return res
        .status(401)
        .json({ error: { message: 'Invalid or expired reset ticket', status: 401 } });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await sequelize.query(
      'UPDATE users SET password_hash = :passwordHash, updated_at = :now WHERE user_id = :userId',
      {
        replacements: { passwordHash, now: new Date(), userId: user.user_id },
        type: QueryTypes.UPDATE,
      },
    );

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch {
    return res
      .status(401)
      .json({ error: { message: 'Invalid or expired reset ticket', status: 401 } });
  }
});

// POST /auth/google — verifies a Google ID token. Existing user -> full
// auth JWT (same shape as /auth/login). New user -> a social ticket the
// client must exchange (after collecting a phone number + role) via
// POST /auth/social/complete.
app.post('/auth/google', async (req: Request, res: Response) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid Google auth payload',
        status: 400,
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    const identity = await verifyGoogleIdToken(parsed.data.id_token);
    const existingUser = await findUserBySocialId('google_id', identity.providerId);

    if (existingUser) {
      await touchLastLogin(existingUser.user_id);
      const token = issueJwt({
        userId: existingUser.user_id,
        role: existingUser.role,
        bfamId: existingUser.bfam_id,
      });
      return res.status(200).json({
        token,
        user_id: existingUser.user_id,
        bfam_id: existingUser.bfam_id,
        role: existingUser.role,
      });
    }

    const socialTicket = issueSocialTicket({
      provider: 'google',
      google_id: identity.providerId,
      email: identity.email,
      name: identity.name,
    });
    return res
      .status(200)
      .json({ social_ticket: socialTicket, email: identity.email, name: identity.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google sign-in failed';
    return res.status(401).json({ error: { message, status: 401 } });
  }
});

// POST /auth/apple — same shape as /auth/google, verified via
// apple-signin-auth. Apple only reliably supplies an email on the user's
// FIRST authorization, so `email` may be null here.
app.post('/auth/apple', async (req: Request, res: Response) => {
  const parsed = appleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid Apple auth payload',
        status: 400,
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    const identity = await verifyAppleIdentityToken(parsed.data.identity_token);
    const existingUser = await findUserBySocialId('apple_id', identity.providerId);

    if (existingUser) {
      await touchLastLogin(existingUser.user_id);
      const token = issueJwt({
        userId: existingUser.user_id,
        role: existingUser.role,
        bfamId: existingUser.bfam_id,
      });
      return res.status(200).json({
        token,
        user_id: existingUser.user_id,
        bfam_id: existingUser.bfam_id,
        role: existingUser.role,
      });
    }

    // Apple's identity token never carries a name; the client-supplied
    // `name` (available only on the user's first native sign-in) is passed
    // through onto the ticket if present.
    const socialTicket = issueSocialTicket({
      provider: 'apple',
      apple_id: identity.providerId,
      email: identity.email,
      name: parsed.data.name ?? null,
    });
    return res
      .status(200)
      .json({ social_ticket: socialTicket, email: identity.email, name: parsed.data.name ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apple sign-in failed';
    return res.status(401).json({ error: { message, status: 401 } });
  }
});

// POST /auth/social/complete — exchanges a social ticket (from /auth/google
// or /auth/apple, new-user branch) plus a collected phone number + role for
// a real account, created exactly like /auth/register (same allocator
// usage, same optional `players` row). password_hash is NOT NULL in the
// schema, so social-only accounts get a random, never-disclosed bcrypt hash
// — the user authenticates via the social provider only, never a BFAM
// password (flagged in the module report).
app.post('/auth/social/complete', async (req: Request, res: Response) => {
  const parsed = socialCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid social signup payload',
        status: 400,
        details: parsed.error.flatten(),
      },
    });
  }

  const {
    social_ticket,
    phone_number,
    role,
    favorite_cricketer_name,
    favorite_cricketer_external_id,
  } = parsed.data;

  // Ticket verification is checked separately from account creation so ANY
  // failure here (invalid signature, expired, wrong purpose) always yields
  // a clean 401 rather than being caught by the generic 409 below.
  let ticket;
  try {
    ticket = verifyTicket(social_ticket, 'social_verified');
  } catch {
    return res
      .status(401)
      .json({ error: { message: 'Invalid or expired social ticket', status: 401 } });
  }

  try {
    // Social-only accounts never authenticate with a BFAM password — this
    // hash is random and never disclosed to the user (see comment above).
    const passwordHash = await bcrypt.hash(`${randomUUID()}${randomUUID()}`, 10);
    const { userId, bfamId } = await createUserAccount({
      phoneNumber: phone_number,
      email: ticket.email ?? undefined,
      passwordHash,
      role: role as UserRole,
      googleId: ticket.provider === 'google' ? ticket.google_id : null,
      appleId: ticket.provider === 'apple' ? ticket.apple_id : null,
      favoriteCricketerName: favorite_cricketer_name,
      favoriteCricketerExternalId: favorite_cricketer_external_id,
    });

    const token = issueJwt({ userId, role: role as UserRole, bfamId });
    return res.status(201).json({ token, user_id: userId, bfam_id: bfamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Social signup failed';
    return res.status(409).json({ error: { message, status: 409 } });
  }
});

// GET /cricketers/search — public autocomplete proxy for Favorite Cricketer
// Search (no PII, no auth required). Proxies CricAPI, or a small built-in
// fixture list when CRICKET_API_KEY is unset (dev/test only — see
// services/cricketerSearchService.ts).
app.get('/cricketers/search', async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    const results = await searchCricketers(query);
    return res.status(200).json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cricketer search failed';
    return res.status(502).json({ error: { message, status: 502 } });
  }
});

app.post('/auth/dev-token', (req: Request, res: Response) => {
  const role = req.body?.role as UserRole;
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: { message: 'Invalid role', status: 400 } });
  }

  const token = issueJwt({
    userId: req.body?.user_id,
    role,
    bfamId: req.body?.bfam_id,
  });

  return res.status(201).json({ token });
});

app.get('/auth/me', authenticateJwt, (req: Request, res: Response) => {
  return res.status(200).json({ auth: req.auth });
});

// GET/PATCH /profile/me — Module 2.2 (Player Profile / Profile Setup).
// Backs both the identity fields every role has (users table) and the
// cricket-specific fields PLAYER accounts have (players table) in one call.
app.get('/profile/me', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const profile = await getMyProfile(req.auth!.sub);
    if (!profile) {
      return res.status(404).json({ error: { message: 'Profile not found', status: 404 } });
    }
    return res.status(200).json(profile);
  } catch {
    return res.status(500).json({ error: { message: 'Failed to load profile', status: 500 } });
  }
});

app.patch('/profile/me', authenticateJwt, async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: 'Invalid profile update', status: 400, details: parsed.error.flatten() },
    });
  }
  try {
    await updateMyProfile(req.auth!.sub, req.auth!.role, parsed.data);
    const profile = await getMyProfile(req.auth!.sub);
    return res.status(200).json(profile);
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    return res.status(500).json({ error: { message: 'Failed to update profile', status: 500 } });
  }
});

// POST /profile/email/send-otp — sends a 6-digit code to the email being
// added to the caller's profile (via Brevo — see services/emailService.ts).
// The email is NOT saved yet; only /verify-otp below persists it, and only
// on a correct code. `dev_otp` is only ever included outside production,
// same convention as /auth/otp/send.
app.post('/profile/email/send-otp', authenticateJwt, async (req: Request, res: Response) => {
  const parsed = sendEmailOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: 'Invalid email', status: 400, details: parsed.error.flatten() },
    });
  }
  try {
    const { code, deliveryError } = await generateAndSendOtp(parsed.data.email, 'EMAIL_VERIFY');
    return res.status(200).json({
      message: 'OTP sent',
      ...(process.env.NODE_ENV !== 'production' ? { dev_otp: code } : {}),
      // Outside production only — tells the caller *why* a real email
      // didn't actually go out (e.g. Brevo's IP allowlist), instead of the
      // code just silently never arriving with no explanation.
      ...(process.env.NODE_ENV !== 'production' && deliveryError
        ? { dev_email_error: deliveryError }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return res.status(500).json({ error: { message, status: 500 } });
  }
});

// POST /profile/email/verify-otp — verifies the code and, only then,
// persists the email + email_verified_at together (setVerifiedEmail) so an
// unverified email can never end up on a profile.
app.post('/profile/email/verify-otp', authenticateJwt, async (req: Request, res: Response) => {
  const parsed = verifyEmailOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { message: 'Invalid request', status: 400, details: parsed.error.flatten() },
    });
  }
  const { email, otp } = parsed.data;

  try {
    const result = await verifyAndConsumeOtp(email, 'EMAIL_VERIFY', otp);
    if (result !== 'VALID') {
      return res.status(400).json({
        error: {
          message: `OTP is ${result === 'NOT_FOUND' ? 'not found or already used' : result.toLowerCase()}`,
          status: 400,
        },
      });
    }

    await setVerifiedEmail(req.auth!.sub, email);
    const profile = await getMyProfile(req.auth!.sub);
    return res.status(200).json(profile);
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    return res.status(500).json({ error: { message: 'Failed to verify email', status: 500 } });
  }
});

// POST /profile/photo — uploads a profile photo to S3 and persists the
// resulting URL onto users.profile_photo_url. Returns 501 if S3 isn't
// configured on this server (see uploadService.ts / the S3 setup
// walkthrough) so the mobile client can fall back to its local-only stub
// behavior instead of a confusing 500.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
app.post(
  '/profile/photo',
  authenticateJwt,
  photoUpload.single('photo'),
  async (req: Request, res: Response) => {
    if (!isS3Configured()) {
      return res.status(501).json({
        error: { message: 'Photo upload storage is not configured on this server', status: 501 },
      });
    }
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: { message: 'No photo file provided', status: 400 } });
    }
    if (!isAllowedImageContentType(file.mimetype)) {
      return res.status(400).json({
        error: { message: 'Unsupported image type — use JPEG, PNG, or WebP', status: 400 },
      });
    }

    try {
      const url = await uploadProfilePhoto(req.auth!.sub, file.buffer, file.mimetype);
      await updateMyProfile(req.auth!.sub, req.auth!.role, { profile_photo_url: url });
      return res.status(200).json({ profile_photo_url: url });
    } catch {
      return res.status(500).json({ error: { message: 'Failed to upload photo', status: 500 } });
    }
  },
);

app.get(
  '/rbac/admin-check',
  authenticateJwt,
  requireRoles('ADMIN'),
  (req: Request, res: Response) => {
    return res.status(200).json({ allowed: true, role: req.auth?.role });
  },
);

// Admin-only BFAM ID reservation system (PRD §12.59, updated) — lets an
// admin lock a premium/jersey-number ID (e.g. BF7, BF18) out of the normal
// sequential allocator (see services/bfamIdAllocator.ts), then later assign
// it to a specific existing PLAYER, overriding their previously
// auto-allocated ID. See services/adminBfamIdService.ts.
app.post(
  '/admin/bfam-ids/lock',
  authenticateJwt,
  requireRoles('ADMIN'),
  async (req: Request, res: Response) => {
    const parsed = lockBfamIdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid lock request', status: 400, details: parsed.error.flatten() },
      });
    }
    try {
      const result = await lockBfamId(parsed.data.bfam_id, req.auth!.sub, parsed.data.notes);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof AdminBfamIdError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      return res.status(500).json({ error: { message: 'Failed to lock BFAM ID', status: 500 } });
    }
  },
);

app.post(
  '/admin/bfam-ids/:bfamId/unlock',
  authenticateJwt,
  requireRoles('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      await unlockBfamId(req.params.bfamId);
      return res.status(200).json({ bfam_id: req.params.bfamId, status: 'UNLOCKED' });
    } catch (error) {
      if (error instanceof AdminBfamIdError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      return res.status(500).json({ error: { message: 'Failed to unlock BFAM ID', status: 500 } });
    }
  },
);

app.post(
  '/admin/bfam-ids/:bfamId/assign',
  authenticateJwt,
  requireRoles('ADMIN'),
  async (req: Request, res: Response) => {
    const parsed = assignBfamIdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid assign request', status: 400, details: parsed.error.flatten() },
      });
    }
    try {
      await assignBfamId(req.params.bfamId, parsed.data.user_id);
      return res
        .status(200)
        .json({ bfam_id: req.params.bfamId, user_id: parsed.data.user_id, status: 'ASSIGNED' });
    } catch (error) {
      if (error instanceof AdminBfamIdError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      return res.status(500).json({ error: { message: 'Failed to assign BFAM ID', status: 500 } });
    }
  },
);

app.get(
  '/admin/bfam-ids',
  authenticateJwt,
  requireRoles('ADMIN'),
  async (_req: Request, res: Response) => {
    try {
      const reservations = await listReservedBfamIds();
      return res.status(200).json(reservations);
    } catch {
      return res
        .status(500)
        .json({ error: { message: 'Failed to list reserved BFAM IDs', status: 500 } });
    }
  },
);

// Module 2.4 — Razorpay webhook: verifies the signature, drives the
// payment_status state machine (PENDING -> SUCCESS/FAILED), allocates a
// SUCCESS payment across the obligations named in the order's `notes`
// (set at order-creation time — see services/paymentService.ts), and
// appends the raw event to payment_events for reconciliation regardless.
app.post('/payments/razorpay/webhook', async (req: Request, res: Response) => {
  try {
    verifyRazorpayWebhookSignature(
      req.rawBody ?? Buffer.from(JSON.stringify(req.body)),
      req.headers['x-razorpay-signature'] as string | undefined,
    );
  } catch (error) {
    if (error instanceof GatewayNotConfiguredError) {
      return res.status(503).json({ error: { message: error.message, status: 503 } });
    }
    if (error instanceof InvalidWebhookSignatureError) {
      return res.status(400).json({ error: { message: error.message, status: 400 } });
    }
    throw error;
  }

  const event = req.body?.event;
  const paymentEntity = req.body?.payload?.payment?.entity;

  if (typeof event !== 'string' || !paymentEntity?.order_id || !paymentEntity?.id) {
    return res.status(400).json({ error: { message: 'Malformed webhook payload', status: 400 } });
  }

  try {
    let internalPaymentId: string | undefined;

    if (event === 'payment.captured' || event === 'payment.failed') {
      const notes = (paymentEntity.notes ?? {}) as Record<string, string>;
      const obligationIds: string[] = notes.obligation_ids ? JSON.parse(notes.obligation_ids) : [];
      const updated = await confirmGatewayPayment(
        paymentEntity.order_id,
        paymentEntity.id,
        event,
        obligationIds,
      );
      internalPaymentId = updated?.payment_id;
    }

    const persisted = await persistRazorpayWebhookEvent({
      ...req.body,
      event,
      payment_id: internalPaymentId ?? paymentEntity.id,
    });
    return res.status(202).json({ received: true, ...persisted });
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      // An order we don't recognize — acknowledge anyway so Razorpay stops
      // retrying. Can legitimately happen for events from a shared test
      // account that aren't for a BFAM-created order.
      return res.status(202).json({ received: true, ignored: true });
    }
    const message = error instanceof Error ? error.message : 'Invalid webhook payload';
    return res.status(400).json({ error: { message, status: 400 } });
  }
});

app.post('/push/expo-token', authenticateJwt, (req: Request, res: Response) => {
  try {
    const result = registerExpoPushToken(req.auth!.sub, req.body?.expo_push_token);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid push token';
    return res.status(400).json({ error: { message, status: 400 } });
  }
});

// Module 2.3 — Turf Discovery & Booking (PRD §12.7, §15).
app.use('/turfs', turfsRouter);
app.use('/bookings', bookingsRouter);
// Module 2.4 — Payments (PRD §17, §12.16).
app.use('/payments', paymentsRouter);
// Module 2.5 — Teams (PRD §12.3, §12.4).
app.use('/teams', teamsRouter);
app.use('/matches', matchesRouter);

// Sentry Error Handler setup for v8
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

type HttpError = Error & { status?: number; statusCode?: number };

// Custom Fallback Error Handler middleware
app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error Handler] ${statusCode} - ${message}`, err);

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
    },
  });
});

export default app;
