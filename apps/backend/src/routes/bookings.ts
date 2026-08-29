import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  cancelBookingSchema,
  createBookingSchema,
  listMyBookingsQuerySchema,
} from '../validation/schemas';
import {
  cancelBooking,
  createBooking,
  getBookingById,
  listBookingsForUser,
} from '../services/bookingService';
import {
  BookingNotFoundError,
  ForbiddenActionError,
  InvalidBookingStateError,
  InvalidSlotAlignmentError,
  NoPricingConfiguredError,
  OutsideOperatingHoursError,
  SlotBlockedError,
  SlotUnavailableError,
  TurfNotFoundError,
} from '../domain/errors';

const router = Router();

// POST /bookings — reserves a turf slot. Booking Confirmation (mobile) hands
// off to a payment step stub from here; this module never marks a booking
// CONFIRMED itself (that's module 2.4, Payments).
router.post(
  '/',
  authenticateJwt,
  requireRoles('PLAYER'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid booking payload', status: 400, details: parsed.error.flatten() },
      });
    }

    try {
      const booking = await createBooking({
        turfId: parsed.data.turf_id,
        bookedBy: req.auth!.sub,
        bookingDate: parsed.data.booking_date,
        startTime: parsed.data.start_time,
        durationMinutes: parsed.data.duration_minutes,
        paymentMode: parsed.data.payment_mode,
      });
      return res.status(201).json(booking);
    } catch (error) {
      // PRD §15: no-double-booking must fail cleanly, never with a raw DB error.
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
        error instanceof InvalidSlotAlignmentError
      ) {
        return res.status(422).json({ error: { message: error.message, status: 422 } });
      }
      throw error;
    }
  }),
);

// GET /bookings/mine — My Bookings.
router.get(
  '/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = listMyBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid query parameters', status: 400 } });
    }
    const bookings = await listBookingsForUser(req.auth!.sub, parsed.data.scope ?? 'all');
    return res.status(200).json({ results: bookings });
  }),
);

// GET /bookings/:bookingId — Booking Details.
router.get(
  '/:bookingId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const booking = await getBookingById(req.params.bookingId, {
        userId: req.auth!.sub,
        role: req.auth!.role,
      });
      return res.status(200).json(booking);
    } catch (error) {
      if (error instanceof BookingNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      if (error instanceof ForbiddenActionError) {
        return res.status(403).json({ error: { message: error.message, status: 403 } });
      }
      throw error;
    }
  }),
);

// POST /bookings/:bookingId/cancel — Cancel Booking.
router.post(
  '/:bookingId/cancel',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = cancelBookingSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid cancellation payload', status: 400 } });
    }

    try {
      const booking = await cancelBooking(
        req.params.bookingId,
        { userId: req.auth!.sub, role: req.auth!.role },
        parsed.data.cancellation_reason,
      );
      return res.status(200).json(booking);
    } catch (error) {
      if (error instanceof BookingNotFoundError) {
        return res.status(404).json({ error: { message: error.message, status: 404 } });
      }
      if (error instanceof ForbiddenActionError) {
        return res.status(403).json({ error: { message: error.message, status: 403 } });
      }
      if (error instanceof InvalidBookingStateError) {
        return res.status(409).json({ error: { message: error.message, status: 409 } });
      }
      throw error;
    }
  }),
);

export default router;
