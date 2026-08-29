import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { turfAvailabilityQuerySchema, turfListQuerySchema } from '../validation/schemas';
import { getTurfAvailability, getTurfDetails, listTurfs } from '../services/turfService';
import { TurfNotFoundError } from '../domain/errors';

const router = Router();

// GET /turfs — Turf Listing search/filter (PRD §12.7). Map view is
// explicitly out of scope for this module.
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = turfListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid search/filter parameters',
          status: 400,
          details: parsed.error.flatten(),
        },
      });
    }

    const result = await listTurfs(parsed.data);
    return res.status(200).json(result);
  }),
);

// GET /turfs/:turfId — Turf Details: gallery, facilities, pricing, and an
// availability preview slice (Design §3.3's hero + facilities row + slot
// grid pattern).
router.get(
  '/:turfId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const details = await getTurfDetails(req.params.turfId);
    if (!details) {
      return res.status(404).json({ error: { message: 'Turf not found', status: 404 } });
    }
    return res.status(200).json(details);
  }),
);

// GET /turfs/:turfId/availability?date=YYYY-MM-DD — full slot grid for a
// single date (Design §1.2/§1.3: available vs. booked, never green).
router.get(
  '/:turfId/availability',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = turfAvailabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'A valid `date` query parameter (YYYY-MM-DD) is required', status: 400 },
      });
    }

    try {
      const availability = await getTurfAvailability(req.params.turfId, parsed.data.date);
      return res.status(200).json(availability);
    } catch (error) {
      if (error instanceof TurfNotFoundError) {
        return res.status(404).json({ error: { message: 'Turf not found', status: 404 } });
      }
      throw error;
    }
  }),
);

export default router;
