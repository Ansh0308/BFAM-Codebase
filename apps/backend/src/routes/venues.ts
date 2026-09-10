import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getVenueForPlayer } from '../services/turfService';
import { VenueNotFoundError } from '../domain/errors';

const router = Router();

// GET /venues/:venueId — player-facing pitch picker (feedback backlog):
// Discover shows one card per venue; a player taps it, sees the venue's
// pitches, and picks one to see its normal Turf Details/booking flow.
router.get(
  '/:venueId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const venue = await getVenueForPlayer(req.params.venueId);
      return res.status(200).json(venue);
    } catch (error) {
      if (error instanceof VenueNotFoundError) {
        return res.status(404).json({ error: { message: 'Venue not found', status: 404 } });
      }
      throw error;
    }
  }),
);

export default router;
