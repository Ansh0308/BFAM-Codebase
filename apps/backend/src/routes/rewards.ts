import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { InsufficientCoinBalanceError, RewardNotFoundError } from '../domain/errors';
import { resolveOwnPlayerId } from '../services/statisticsService';
import { listActiveRewards, listMyRedemptions, redeemReward } from '../services/rewardsService';

const router = Router();

// GET /rewards — the catalog (long tail, PRD §12.36).
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json({ results: await listActiveRewards() });
  }),
);

// GET /rewards/redemptions/mine — registered before /:rewardId so "redemptions"
// is never mistaken for a reward id.
router.get(
  '/redemptions/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const playerId = await resolveOwnPlayerId(req.auth!.sub);
    return res.status(200).json({ results: await listMyRedemptions(playerId) });
  }),
);

// POST /rewards/:rewardId/redeem — spends coins, records a PENDING redemption.
router.post(
  '/:rewardId/redeem',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const playerId = await resolveOwnPlayerId(req.auth!.sub);
      const result = await redeemReward(playerId, req.params.rewardId);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof RewardNotFoundError) {
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
