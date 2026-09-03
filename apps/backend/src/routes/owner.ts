import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  assignStaffSchema,
  createAvailabilityBlockSchema,
  createTurfSchema,
  reviewVerificationSchema,
  setPricingSchema,
  setSoundSettingSchema,
  updateTurfSchema,
} from '../validation/schemas';
import {
  createAvailabilityBlock,
  createTurf,
  getTodaysBookings,
  getTurfForOwner,
  listAvailabilityBlocks,
  listMatchesForOwner,
  listMyTurfs,
  listPaymentsForOwner,
  listPricing,
  removeAvailabilityBlock,
  setPricing,
  setStadiumSoundEnabled,
  updateTurf,
} from '../services/ownerService';
import {
  assignStaff,
  listStaffForTurf,
  removeStaff,
  reviewVerification,
} from '../services/staffService';
import {
  ForbiddenActionError,
  StaffAssignmentNotFoundError,
  TurfNotFoundError,
} from '../domain/errors';

const router = Router();

function handleOwnerError(error: unknown, res: Response) {
  if (error instanceof TurfNotFoundError || error instanceof StaffAssignmentNotFoundError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  return null;
}

// Every route in this file is TURF_OWNER-only (module 2.12, PRD §8.3/§9.2).
router.use(authenticateJwt, requireRoles('TURF_OWNER'));

// GET /owner/turfs — Owner Dashboard's turf list.
router.get(
  '/turfs',
  asyncHandler(async (req: Request, res: Response) => {
    const turfs = await listMyTurfs(req.auth!.sub);
    return res.status(200).json({ results: turfs });
  }),
);

// POST /owner/turfs — Turf Management: add a turf.
router.post(
  '/turfs',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createTurfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid turf payload', status: 400 } });
    }
    const turf = await createTurf(req.auth!.sub, parsed.data);
    return res.status(201).json(turf);
  }),
);

// GET/PATCH /owner/turfs/:turfId — Turf Management: view/edit a turf.
router.get(
  '/turfs/:turfId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const turf = await getTurfForOwner(req.params.turfId, req.auth!.sub);
      return res.status(200).json(turf);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.patch(
  '/turfs/:turfId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateTurfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid turf payload', status: 400 } });
    }
    try {
      const turf = await updateTurf(req.params.turfId, req.auth!.sub, parsed.data);
      return res.status(200).json(turf);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// PATCH /owner/turfs/:turfId/sound — Sound Settings.
router.patch(
  '/turfs/:turfId/sound',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setSoundSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const result = await setStadiumSoundEnabled(
        req.params.turfId,
        req.auth!.sub,
        parsed.data.stadium_sound_enabled,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /owner/turfs/:turfId/pricing — Pricing.
router.get(
  '/turfs/:turfId/pricing',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const pricing = await listPricing(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: pricing });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// PUT /owner/turfs/:turfId/pricing — Pricing.
router.put(
  '/turfs/:turfId/pricing',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setPricingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid pricing payload', status: 400 } });
    }
    try {
      const pricing = await setPricing(req.params.turfId, req.auth!.sub, parsed.data.rows);
      return res.status(200).json({ results: pricing });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET/POST /owner/turfs/:turfId/availability-blocks — Availability Management.
router.get(
  '/turfs/:turfId/availability-blocks',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const blocks = await listAvailabilityBlocks(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: blocks });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.post(
  '/turfs/:turfId/availability-blocks',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createAvailabilityBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid block payload', status: 400 } });
    }
    try {
      const block = await createAvailabilityBlock(req.params.turfId, req.auth!.sub, parsed.data);
      return res.status(201).json(block);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.delete(
  '/availability-blocks/:blockId',
  asyncHandler(async (req: Request, res: Response) => {
    await removeAvailabilityBlock(req.params.blockId, req.auth!.sub);
    return res.status(204).send();
  }),
);

// GET /owner/bookings/today — Today's Bookings.
router.get(
  '/bookings/today',
  asyncHandler(async (req: Request, res: Response) => {
    const bookings = await getTodaysBookings(req.auth!.sub);
    return res.status(200).json({ results: bookings });
  }),
);

// GET /owner/matches — Match Management.
router.get(
  '/matches',
  asyncHandler(async (req: Request, res: Response) => {
    const matches = await listMatchesForOwner(req.auth!.sub);
    return res.status(200).json({ results: matches });
  }),
);

// GET /owner/payments — Payments incl. Cash Reconciliation.
router.get(
  '/payments',
  asyncHandler(async (req: Request, res: Response) => {
    const payments = await listPaymentsForOwner(req.auth!.sub);
    return res.status(200).json({ results: payments });
  }),
);

// GET/POST /owner/turfs/:turfId/staff — Staff Management.
router.get(
  '/turfs/:turfId/staff',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const staff = await listStaffForTurf(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: staff });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.post(
  '/turfs/:turfId/staff',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = assignStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const assignment = await assignStaff(
        req.params.turfId,
        req.auth!.sub,
        parsed.data.staff_user_id,
      );
      return res.status(201).json(assignment);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.delete(
  '/staff/:assignmentId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await removeStaff(req.params.assignmentId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /owner/staff/:assignmentId/review — Staff Verification, step 2
// (PRD §32.14).
router.post(
  '/staff/:assignmentId/review',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = reviewVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid review payload', status: 400 } });
    }
    try {
      const assignment = await reviewVerification(
        req.params.assignmentId,
        req.auth!.sub,
        parsed.data.decision,
        parsed.data.rejection_reason,
      );
      return res.status(200).json(assignment);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

export default router;
