import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { finalizeMatchSchema, recordBallSchema, startInningsSchema } from '../validation/schemas';
import {
  finalizeMatch,
  getLiveScore,
  getMatchResult,
  getScorecard,
  recordBall,
  startInnings,
  undoLastBall,
} from '../services/scoringService';
import {
  ForbiddenActionError,
  InningsNotFoundError,
  InvalidScoringStateError,
  MatchNotFoundError,
  NoBallToUndoError,
} from '../domain/errors';

const router = Router();

function handleScoringError(error: unknown, res: Response) {
  if (error instanceof MatchNotFoundError || error instanceof InningsNotFoundError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof InvalidScoringStateError || error instanceof NoBallToUndoError) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  return null;
}

// POST /matches/:matchId/innings — start an innings.
router.post(
  '/matches/:matchId/innings',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = startInningsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid innings payload', status: 400 } });
    }
    try {
      const innings = await startInnings(req.params.matchId, req.auth!.sub, parsed.data);
      return res.status(201).json(innings);
    } catch (error) {
      const handled = handleScoringError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /innings/:inningsId/balls — record a ball (PRD §12.18).
router.post(
  '/innings/:inningsId/balls',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = recordBallSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid ball payload', status: 400, details: parsed.error.flatten() },
      });
    }
    try {
      const result = await recordBall(req.params.inningsId, req.auth!.sub, {
        ...parsed.data,
        non_striker_player_id: parsed.data.non_striker_player_id ?? null,
        wicket_type: parsed.data.wicket_type ?? null,
        dismissed_player_id: parsed.data.dismissed_player_id ?? null,
        fielder_player_id: parsed.data.fielder_player_id ?? null,
      });
      return res.status(201).json(result);
    } catch (error) {
      const handled = handleScoringError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /innings/:inningsId/undo — reverse the last recorded ball.
router.post(
  '/innings/:inningsId/undo',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await undoLastBall(req.params.inningsId, req.auth!.sub);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleScoringError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/:matchId/live — Live Score viewer header.
router.get(
  '/matches/:matchId/live',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await getLiveScore(req.params.matchId);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleScoringError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/:matchId/scorecard — batting/bowling tables, extras, FOW.
router.get(
  '/matches/:matchId/scorecard',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getScorecard(req.params.matchId);
    return res.status(200).json(result);
  }),
);

// POST /matches/:matchId/result — finalize the match.
router.post(
  '/matches/:matchId/result',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = finalizeMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid result payload', status: 400 } });
    }
    try {
      const result = await finalizeMatch(req.params.matchId, req.auth!.sub, parsed.data);
      return res.status(201).json(result);
    } catch (error) {
      const handled = handleScoringError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/:matchId/result — Match Result screen.
router.get(
  '/matches/:matchId/result',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await getMatchResult(req.params.matchId);
    if (!result) return res.status(404).json({ error: { message: 'No result yet', status: 404 } });
    return res.status(200).json(result);
  }),
);

export default router;
