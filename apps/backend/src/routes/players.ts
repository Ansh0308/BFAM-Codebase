import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { contactsLookupSchema } from '../validation/schemas';
import { matchContactsToPlayers } from '../services/contactsService';
import { getPublicProfile, searchPlayers } from '../services/profileService';
import { followPlayer, unfollowPlayer } from '../services/followService';
import {
  CannotFollowSelfError,
  PlayerNotFoundError,
  PlayerProfileNotFoundError,
} from '../domain/errors';

const router = Router();

function handleFollowError(error: unknown, res: Response) {
  if (error instanceof PlayerNotFoundError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof CannotFollowSelfError) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  if (error instanceof PlayerProfileNotFoundError) {
    return res.status(422).json({ error: { message: error.message, status: 422 } });
  }
  return null;
}

// GET /players/search?q= (backlog B-12): Player Search from the Home top
// nav — matches by name or BFAM ID. Registered ahead of the /:playerId
// catch-all below, or "search" would be parsed as a playerId.
router.get(
  '/search',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchPlayers(q);
    return res.status(200).json({ results });
  }),
);

// GET /players/:playerId (backlog B-10): another player's public profile —
// reachable from a roster/team-member row's avatar/name. See
// profileService.getPublicProfile for exactly what is and isn't included.
// Backlog B-9 adds follow_summary (follower/following counts + whether the
// caller currently follows this player) to the same response.
router.get(
  '/:playerId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const profile = await getPublicProfile(req.params.playerId, req.auth!.sub);
      return res.status(200).json(profile);
    } catch (error) {
      if (error instanceof PlayerNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      throw error;
    }
  }),
);

// POST /players/:playerId/follow (backlog B-9) — idempotent.
router.post(
  '/:playerId/follow',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await followPlayer(req.auth!.sub, req.params.playerId);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleFollowError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// DELETE /players/:playerId/follow (backlog B-9) — idempotent.
router.delete(
  '/:playerId/follow',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await unfollowPlayer(req.auth!.sub, req.params.playerId);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleFollowError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /players/contacts-lookup (backlog B-2): given a batch of phone
// numbers from the caller's device contacts, returns only the ones that
// match a registered player — see contactsService.ts for the privacy
// rationale behind never echoing back non-matches. Auth-gated like every
// other endpoint here; there's no reason to widen this beyond a logged-in
// user, and doing so would only increase how much of the numbers-on-BFAM
// question a caller could probe anonymously.
router.post(
  '/contacts-lookup',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = contactsLookupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid contacts payload', status: 400 } });
    }
    const results = await matchContactsToPlayers(parsed.data.phone_numbers);
    return res.status(200).json({ results });
  }),
);

export default router;
