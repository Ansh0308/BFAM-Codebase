import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { recordConsentSchema } from '../validation/schemas';
import { getMyConsents, recordConsent, type ConsentType } from '../services/consentService';

const router = Router();

// POST /consents (backlog G-21, PRD §32.8) — records a versioned consent
// event for LOCATION/CONTACTS/PAYMENT_DATA at the moment the app actually
// requests that permission/data (e.g. right after a device permission
// prompt is granted) — not a one-time signup checkbox for these three,
// since the app never asks for them until it actually needs to. TERMS is
// deliberately excluded here: it's recorded server-side inside
// createUserAccount itself, tied to the existing waiver_accepted
// requirement, never as a separate client-initiated call.
router.post(
  '/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = recordConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid consent payload', status: 400, details: parsed.error.flatten() },
      });
    }
    await recordConsent(req.auth!.sub, parsed.data.consent_type as ConsentType);
    return res.status(201).json({ recorded: true });
  }),
);

// GET /consents/mine — a caller's own consent history, most recent first.
router.get(
  '/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const consents = await getMyConsents(req.auth!.sub);
    return res.status(200).json({ results: consents });
  }),
);

export default router;
