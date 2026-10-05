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
import { setTurfClosedSchema } from '../validation/schemas';
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
