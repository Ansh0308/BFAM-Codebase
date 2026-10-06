import { Router, Request, Response } from 'express';
import multer from 'multer';
import { allowAdminActAs, authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getMyAssignments,
  getTodaysBookingsForStaff,
  listMatchesForStaff,
  submitVerificationDocument,
} from '../services/staffService';
import {
  isAllowedVerificationDocumentContentType,
  isS3Configured,
  uploadStaffVerificationDocument,
} from '../services/uploadService';
import { StaffAssignmentNotFoundError } from '../domain/errors';
import {
  setTurfClosedSchema,
  staffCustomerLookupSchema,
  staffTicketSchema,
  staffWalkInSchema,
} from '../validation/schemas';
import {
  StaffAssistError,
  createWalkInBooking,
  lookupCustomers,
  raiseTicketForCustomer,
} from '../services/staffAssistService';
import { BookingTooFarAheadError, MaintenanceModeError } from '../services/settingsService';
import {
  InvalidSlotAlignmentError,
  NoPricingConfiguredError,
  OutsideOperatingHoursError,
  SlotBlockedError,
  SlotUnavailableError,
  StaffNotVerifiedError,
  TurfNotFoundError,
} from '../domain/errors';
import {
  TurfDayError,
  listTurfDayStatus,
  setTurfClosedToday,
} from '../services/turfDayStatusService';

const router = Router();

// Every route in this file is TURF_STAFF-only (module 2.12, PRD §8.4/§9.3).
router.use(authenticateJwt, allowAdminActAs, requireRoles('TURF_STAFF'));

// GET /staff/bookings/today — Today's Bookings.
router.get(
  '/bookings/today',
  asyncHandler(async (req: Request, res: Response) => {
    const bookings = await getTodaysBookingsForStaff(req.auth!.sub);
    return res.status(200).json({ results: bookings });
  }),
);

// GET /staff/matches — Match Operations list. Live Score Control and
// Check-In themselves reuse the existing module 2.8/2.6 routes — staff
// simply authenticates as the match's assigned_scorer_id (scoring) or is
// gated by assertStaffVerified inside setPlayerAttendance (check-in); no
// separate staff-only endpoints duplicate that business logic (requirement
// 6 — same backend, same code path, for mobile and web alike).
router.get(
  '/matches',
  asyncHandler(async (req: Request, res: Response) => {
    const matches = await listMatchesForStaff(req.auth!.sub);
    return res.status(200).json({ results: matches });
  }),
);

// GET /staff/turf-status — today's open / closed state of the turf(s) this
// staff member works at (SW-5).
router.get(
  '/turf-status',
  asyncHandler(async (req: Request, res: Response) => {
    const results = await listTurfDayStatus({ userId: req.auth!.sub, role: 'TURF_STAFF' });
    return res.status(200).json({ results });
  }),
);

// POST /staff/turfs/:turfId/closed — close or reopen the turf for today. Needs
// an approved assignment and the owner's "close the turf" permission.
router.post(
  '/turfs/:turfId/closed',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setTurfClosedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'closed (true / false) is required', status: 400 } });
    }
    try {
      const status = await setTurfClosedToday(
        { userId: req.auth!.sub, role: 'TURF_STAFF' },
        req.params.turfId,
        parsed.data.closed,
      );
      return res.status(200).json(status);
    } catch (error) {
      if (error instanceof TurfDayError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      throw error;
    }
  }),
);

// ---- Customer assistance (SW-6) ----

// Same error mapping as the booking route, plus this service's own.
function assistFailure(res: Response, error: unknown) {
  if (error instanceof StaffAssistError) {
    return res
      .status(error.status)
      .json({ error: { message: error.message, status: error.status } });
  }
  if (error instanceof StaffNotVerifiedError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof MaintenanceModeError) {
    return res
      .status(503)
      .json({ error: { message: error.message, status: 503, code: 'MAINTENANCE' } });
  }
  if (error instanceof SlotUnavailableError) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  if (error instanceof TurfNotFoundError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (
    error instanceof SlotBlockedError ||
    error instanceof OutsideOperatingHoursError ||
    error instanceof NoPricingConfiguredError ||
    error instanceof InvalidSlotAlignmentError ||
    error instanceof BookingTooFarAheadError
  ) {
    return res.status(422).json({ error: { message: error.message, status: 422 } });
  }
  throw error;
}

router.get(
  '/customers/lookup',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = staffCustomerLookupSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: { message: 'Type a phone number or BFAM ID (3+ characters).', status: 400 },
        });
    }
    try {
      return res.status(200).json({ results: await lookupCustomers(req.auth!.sub, parsed.data.q) });
    } catch (error) {
      return assistFailure(res, error);
    }
  }),
);

router.post(
  '/bookings/walk-in',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = staffWalkInSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: { message: 'Pick a customer, a date, a start time and a duration.', status: 400 },
        });
    }
    try {
      return res.status(201).json(await createWalkInBooking(req.auth!.sub, parsed.data));
    } catch (error) {
      return assistFailure(res, error);
    }
  }),
);

router.post(
  '/customers/:userId/tickets',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = staffTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: {
            message: 'Choose a category and describe the issue (10+ characters).',
            status: 400,
          },
        });
    }
    try {
      return res
        .status(201)
        .json(
          await raiseTicketForCustomer(req.auth!.sub, {
            customer_user_id: req.params.userId,
            ...parsed.data,
          }),
        );
    } catch (error) {
      return assistFailure(res, error);
    }
  }),
);

// GET /staff/assignments — the staff member's own turf assignment(s),
// incl. verification_status (PRD §32.14).
router.get(
  '/assignments',
  asyncHandler(async (req: Request, res: Response) => {
    const assignments = await getMyAssignments(req.auth!.sub);
    return res.status(200).json({ results: assignments });
  }),
);

// POST /staff/verification-document — Staff Verification, step 1 (PRD
// §32.14): uploads an ID/document for the owner to review.
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
router.post(
  '/verification-document',
  docUpload.single('document'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!isS3Configured()) {
      return res.status(501).json({
        error: { message: 'Document upload storage is not configured on this server', status: 501 },
      });
    }
    const turfId = req.body?.turf_id;
    const file = req.file;
    if (!turfId || !file) {
      return res
        .status(400)
        .json({ error: { message: 'turf_id and a document file are required', status: 400 } });
    }
    if (!isAllowedVerificationDocumentContentType(file.mimetype)) {
      return res.status(400).json({
        error: { message: 'Unsupported document type — use JPEG, PNG, WebP, or PDF', status: 400 },
      });
    }

    try {
      const documentUrl = await uploadStaffVerificationDocument(
        req.auth!.sub,
        file.buffer,
        file.mimetype,
      );
      const assignment = await submitVerificationDocument(req.auth!.sub, turfId, documentUrl);
      return res.status(200).json(assignment);
    } catch (error) {
      if (error instanceof StaffAssignmentNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      throw error;
    }
  }),
);

export default router;
