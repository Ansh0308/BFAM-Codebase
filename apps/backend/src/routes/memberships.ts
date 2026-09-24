import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { InsufficientCoinBalanceError, MembershipPlanNotFoundError } from '../domain/errors';
import { resolveOwnPlayerId } from '../services/statisticsService';
import {
  getActiveMembership,
  listActivePlans,
  subscribeToPlan,
} from '../services/membershipService';

const router = Router();

// GET /memberships/plans (long tail, PRD §12.51)
router.get(
  '/plans',
  authenticateJwt,
  asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json({ results: await listActivePlans() });
  }),
);

// GET /memberships/mine — the active membership, or null.
router.get(
  '/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const playerId = await resolveOwnPlayerId(req.auth!.sub);
    return res.status(200).json({ membership: await getActiveMembership(playerId) });
  }),
);

// POST /memberships/plans/:planId/subscribe — buys (or extends) a plan with coins.
router.post(
  '/plans/:planId/subscribe',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const playerId = await resolveOwnPlayerId(req.auth!.sub);
      const result = await subscribeToPlan(playerId, req.params.planId);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof MembershipPlanNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      if (error instanceof InsufficientCoinBalanceError) {
        return res.status(409).json({ error: { message: error.message, status: 409 } });
      }
      throw error;
    }
  }),
);

export default router;
