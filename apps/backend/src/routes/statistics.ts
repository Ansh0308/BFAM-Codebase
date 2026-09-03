import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getPlayerRating,
  getPlayerStatistics,
  materializeMatchStatistics,
  resolveOwnPlayerId,
  type StatisticsScope,
} from '../services/statisticsService';
import { MatchNotFoundError, PlayerProfileNotFoundError } from '../domain/errors';

const router = Router();

function isStatisticsScope(value: unknown): value is StatisticsScope {
  return value === 'lifetime' || value === 'season';
}

// The mobile client never needs to know its own player_id — "me" resolves
// to the caller's own, same convention as GET /profile/me.
async function resolvePlayerIdParam(req: Request): Promise<string> {
  if (req.params.playerId === 'me') return resolveOwnPlayerId(req.auth!.sub);
  return req.params.playerId;
}

// GET /players/:playerId/statistics?scope=lifetime|season — Player
// Statistics screen (module 2.10, PRD §12.32).
router.get(
  '/players/:playerId/statistics',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const scope = isStatisticsScope(req.query.scope) ? req.query.scope : 'lifetime';
    try {
      const playerId = await resolvePlayerIdParam(req);
      const stats = await getPlayerStatistics(playerId, scope);
      return res.status(200).json(stats);
    } catch (error) {
      if (error instanceof PlayerProfileNotFoundError) {
        return res.status(422).json({ error: { message: error.message, status: 422 } });
      }
      throw error;
    }
  }),
);

// GET /players/:playerId/rating — Basic Skill Rating (module 2.10, PRD
// §12.29), shown on the Player Profile screen.
router.get(
  '/players/:playerId/rating',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const playerId = await resolvePlayerIdParam(req);
      const rating = await getPlayerRating(playerId);
      return res.status(200).json({ player_id: playerId, skill_rating: rating });
    } catch (error) {
      if (error instanceof PlayerProfileNotFoundError) {
        return res.status(422).json({ error: { message: error.message, status: 422 } });
      }
      throw error;
    }
  }),
);

// POST /matches/:matchId/statistics/materialize — manual re-run hook.
// finalizeMatch (module 2.8) already calls this automatically; exposed
// separately because the job is explicitly required to be safe to re-run
// (PRD requirement 1) and this is how that gets exercised outside of the
// finalize flow — e.g. after a scoring correction.
router.post(
  '/matches/:matchId/statistics/materialize',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await materializeMatchStatistics(req.params.matchId);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof MatchNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      throw error;
    }
  }),
);

export default router;
