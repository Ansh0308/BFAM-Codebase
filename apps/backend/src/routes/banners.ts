import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { listActiveBanners } from '../services/bannerService';

const router = Router();

// GET /banners (backlog B-6): the Home page carousel's content — active
// banners only, in display order. Every authenticated role can see these
// (there's no reason to restrict player-facing promotional content by
// role); the ADMIN-only management surface is under /admin/banners.
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (_req: Request, res: Response) => {
    const banners = await listActiveBanners();
    return res.status(200).json({ results: banners });
  }),
);

export default router;
