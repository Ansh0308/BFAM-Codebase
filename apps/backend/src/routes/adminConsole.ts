import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  adminAuditLogQuerySchema,
  adminTicketQuerySchema,
  setPromoCodeActiveSchema,
} from '../validation/schemas';
import {
  getAdminOverview,
  listAuditLogs,
  listTicketsForAdmin,
  PromoCodeNotFoundError,
  setPromoCodeActive,
} from '../services/adminConsoleService';

const router = Router();

// Every route here is ADMIN-only (PRD §9.1).
router.use(authenticateJwt, requireRoles('ADMIN'));

// GET /admin/overview — the Admin Overview landing page (PRD §30.10).
router.get(
  '/overview',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json(await getAdminOverview());
  }),
);

// GET /admin/tickets — the complaint / dispute / injury queue, with real
// status totals. Status changes go through POST /support/tickets/:id/status.
router.get(
  '/tickets',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminTicketQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid ticket filter', status: 400 } });
    }
    const data = await listTicketsForAdmin({
      status: parsed.data.status,
      disputeType: parsed.data.dispute_type,
    });
    return res.status(200).json(data);
  }),
);

// GET /admin/audit-logs — newest first, filterable, paginated.
router.get(
  '/audit-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminAuditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid audit log filter', status: 400 } });
    }
    const data = await listAuditLogs({
      resourceType: parsed.data.resource_type,
      action: parsed.data.action,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return res.status(200).json(data);
  }),
);

// POST /admin/promo-codes/:promoCodeId/active — switch a code on or off.
router.post(
  '/promo-codes/:promoCodeId/active',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setPromoCodeActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'is_active (true/false) is required', status: 400 } });
    }
    try {
      const result = await setPromoCodeActive(
        req.params.promoCodeId,
        parsed.data.is_active,
        req.auth!.sub,
      );
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof PromoCodeNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      throw error;
    }
  }),
);

export default router;
