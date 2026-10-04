import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  adminAuditLogQuerySchema,
  adminBookingsQuerySchema,
  adminBookingStatusSchema,
  adminCreateUserSchema,
  adminResetPasswordSchema,
  adminTicketQuerySchema,
  adminUpdatePromoSchema,
  adminUpdateUserSchema,
  adminUserQuerySchema,
  explorerRowsQuerySchema,
  explorerValuesSchema,
  setPromoCodeActiveSchema,
} from '../validation/schemas';
import {
  AdminUserError,
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminUpdateUser,
  listUsers,
} from '../services/adminUserManagement';
import {
  AdminManageError,
  adminDeletePromoCode,
  adminDeleteTurf,
  adminListBookings,
  adminSetBookingStatus,
  adminUpdatePromoCode,
  explorerDeleteRow,
  explorerGetRows,
  explorerInsertRow,
  explorerListTables,
  explorerUpdateRow,
} from '../services/adminManageService';
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

// Maps the two admin service error types to their HTTP status.
function failWith(res: Response, error: unknown) {
  if (error instanceof AdminUserError || error instanceof AdminManageError) {
    return res
      .status(error.status)
      .json({ error: { message: error.message, status: error.status } });
  }
  throw error;
}

const invalid = (res: Response, message: string) =>
  res.status(400).json({ error: { message, status: 400 } });

// ---- Users: every role ----

router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminUserQuerySchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, 'Invalid user filter');
    return res.status(200).json({ results: await listUsers(parsed.data) });
  }),
);

router.post(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return invalid(
        res,
        'A role, a phone number and a password of at least 8 characters are required.',
      );
    }
    try {
      return res.status(201).json(await adminCreateUser(req.auth!.sub, parsed.data));
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.patch(
  '/users/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminUpdateUserSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, 'Invalid user details');
    try {
      return res
        .status(200)
        .json(await adminUpdateUser(req.auth!.sub, req.params.userId, parsed.data));
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.post(
  '/users/:userId/password',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, 'The password must be at least 8 characters.');
    try {
      await adminResetPassword(req.auth!.sub, req.params.userId, parsed.data.password);
      return res.status(204).send();
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.delete(
  '/users/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await adminDeleteUser(req.auth!.sub, req.params.userId);
      return res.status(204).send();
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

// ---- Bookings: every turf ----

router.get(
  '/bookings',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, 'from and to (YYYY-MM-DD) are required');
    try {
      return res.status(200).json({
        results: await adminListBookings({
          from: parsed.data.from,
          to: parsed.data.to,
          turfId: parsed.data.turf_id,
        }),
      });
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.post(
  '/bookings/:bookingId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminBookingStatusSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, 'status must be PENDING, CONFIRMED or COMPLETED');
    try {
      return res
        .status(200)
        .json(await adminSetBookingStatus(req.auth!.sub, req.params.bookingId, parsed.data.status));
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

// ---- Promo codes: edit and delete (create / list / switch live elsewhere) ----

router.patch(
  '/promo-codes/:promoCodeId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminUpdatePromoSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, 'Invalid promo code details');
    try {
      return res
        .status(200)
        .json(await adminUpdatePromoCode(req.auth!.sub, req.params.promoCodeId, parsed.data));
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.delete(
  '/promo-codes/:promoCodeId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await adminDeletePromoCode(req.auth!.sub, req.params.promoCodeId);
      return res.status(204).send();
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

// ---- Turfs: delete (create / edit happen by acting as the owner) ----

router.delete(
  '/turfs/:turfId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await adminDeleteTurf(req.auth!.sub, req.params.turfId);
      return res.status(204).send();
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

// ---- Data Explorer: browse, add, edit and delete rows in any table ----

router.get(
  '/data/tables',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json({ results: await explorerListTables() });
  }),
);

router.get(
  '/data/:table',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = explorerRowsQuerySchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, 'Invalid paging options');
    try {
      return res.status(200).json(await explorerGetRows(req.params.table, parsed.data));
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.post(
  '/data/:table',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = explorerValuesSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, 'Send the new row as { values: { column: value } }');
    try {
      return res
        .status(201)
        .json(await explorerInsertRow(req.auth!.sub, req.params.table, parsed.data.values));
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.patch(
  '/data/:table/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = explorerValuesSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, 'Send the changes as { values: { column: value } }');
    try {
      return res
        .status(200)
        .json(
          await explorerUpdateRow(
            req.auth!.sub,
            req.params.table,
            req.params.id,
            parsed.data.values,
          ),
        );
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

router.delete(
  '/data/:table/:id',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await explorerDeleteRow(req.auth!.sub, req.params.table, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return failWith(res, error);
    }
  }),
);

export default router;
