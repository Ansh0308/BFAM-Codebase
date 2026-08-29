import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import { initSentry } from './config/sentry';
import { USER_ROLES } from './domain/constants';
import { authenticateJwt, requireRoles } from './middleware/auth';
import { issueJwt, UserRole } from './services/authService';
import { allocateBfamId } from './services/bfamIdAllocator';
import { sequelize } from './config/sequelize';
import { registerUserSchema } from './validation/schemas';
import {
  acknowledgeRazorpayWebhook,
  persistRazorpayWebhookEvent,
} from './services/razorpayService';
import { registerExpoPushToken } from './services/pushNotificationService';
import turfsRouter from './routes/turfs';
import bookingsRouter from './routes/bookings';

// Initialize Sentry before anything else
initSentry();

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());

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

  const { password, ...profile } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const userId = randomUUID();

    const { bfamId } = await allocateBfamId(async (bfamId, transaction) => {
      await sequelize.getQueryInterface().bulkInsert(
        'users',
        [
          {
            user_id: userId,
            phone_number: profile.phone_number,
            email: profile.email ?? null,
            password_hash: passwordHash,
            role: profile.role,
            account_status: 'ACTIVE',
            phone_verified_at: null,
            profile_photo_url: null,
            city: profile.city ?? null,
            preferred_language: profile.preferred_language ?? 'en',
            bfam_id: bfamId,
            google_id: null,
            apple_id: null,
            is_minor: profile.is_minor ?? false,
            last_login_at: null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          },
        ],
        { transaction },
      );
      return userId;
    });

    const token = issueJwt({ userId, role: profile.role, bfamId });
    return res.status(201).json({ token, user_id: userId, bfam_id: bfamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return res.status(409).json({ error: { message, status: 409 } });
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

app.get(
  '/rbac/admin-check',
  authenticateJwt,
  requireRoles('ADMIN'),
  (req: Request, res: Response) => {
    return res.status(200).json({ allowed: true, role: req.auth?.role });
  },
);

app.post('/payments/razorpay/webhook', async (req: Request, res: Response) => {
  try {
    const persisted = await persistRazorpayWebhookEvent(req.body);
    return res.status(202).json({ ...acknowledgeRazorpayWebhook(req.body), ...persisted });
  } catch (error) {
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
