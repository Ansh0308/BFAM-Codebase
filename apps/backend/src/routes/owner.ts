import { Router, Request, Response } from 'express';
import { allowAdminActAs, authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  assignStaffSchema,
  createStaffAccountSchema,
  staffPermissionsSchema,
  setTurfClosedSchema,
  createOfferSchema,
  updateOfferSchema,
  setPromoCodeActiveSchema,
  customerQuerySchema,
  createMaintenanceTaskSchema,
  updateMaintenanceTaskSchema,
  maintenanceQuerySchema,
  assignTurfToVenueSchema,
  ownerBookingRangeSchema,
  copyTurfDetailsSchema,
  createAvailabilityBlockSchema,
  createTurfSchema,
  createVenueSchema,
  reviewVerificationSchema,
  setOperatingHoursSchema,
  setPricingSchema,
  setSoundSettingSchema,
  updateTurfSchema,
  updateVenueSchema,
} from '../validation/schemas';
import {
  assignTurfToVenue,
  copyTurfDetails,
  createAvailabilityBlock,
  createTurf,
  createVenue,
  getTodaysBookings,
  listBookingsForOwner,
  InvalidBookingRangeError,
  getTurfForOwner,
  getVenueForOwner,
  listAvailabilityBlocks,
  listLiveMatchesForOwner,
  listMatchesForOwner,
  listMyTurfs,
  listMyVenues,
  listOperatingHours,
  listPaymentsForOwner,
  listPricing,
  removeAvailabilityBlock,
  setOperatingHours,
  setPricing,
  setStadiumSoundEnabled,
  updateTurf,
  updateVenue,
} from '../services/ownerService';
import { AdminUserError } from '../services/adminUserManagement';
import { AnalyticsError, assertOwnsTurf, getAnalytics } from '../services/analyticsService';
import { CustomerError, getCustomer, listCustomers } from '../services/customerService';
import {
  OfferError,
  createOffer,
  deleteOffer,
  listOffers,
  setOfferActive,
  updateOffer,
} from '../services/ownerOffersService';
import {
  TurfDayError,
  listTurfDayStatus,
  setTurfClosedToday,
} from '../services/turfDayStatusService';
import {
  MaintenanceError,
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from '../services/maintenanceService';
import {
  assignStaff,
  createStaffForTurf,
  getStaffActivity,
  updateStaffPermissions,
  listStaffForTurf,
  removeStaff,
  reviewVerification,
} from '../services/staffService';
import {
  ForbiddenActionError,
  InvalidTurfStateError,
  StaffAssignmentNotFoundError,
  TurfNotFoundError,
  VenueNotFoundError,
} from '../domain/errors';

const router = Router();

function handleOwnerError(error: unknown, res: Response) {
  if (
    error instanceof TurfNotFoundError ||
    error instanceof StaffAssignmentNotFoundError ||
    error instanceof VenueNotFoundError
  ) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof InvalidTurfStateError) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  return null;
}

// Every route in this file is TURF_OWNER-only (module 2.12, PRD §8.3/§9.2).
router.use(authenticateJwt, allowAdminActAs, requireRoles('TURF_OWNER'));

// GET /owner/turfs — Owner Dashboard's turf list.
router.get(
  '/turfs',
  asyncHandler(async (req: Request, res: Response) => {
    const turfs = await listMyTurfs(req.auth!.sub);
    return res.status(200).json({ results: turfs });
  }),
);

// Venues (backlog A-2) — an owner with more than one pitch at the same
// physical location groups them under one venue for display; each pitch
// underneath is still its own independently bookable turf.
router.get(
  '/venues',
  asyncHandler(async (req: Request, res: Response) => {
    const venues = await listMyVenues(req.auth!.sub);
    return res.status(200).json({ results: venues });
  }),
);

router.post(
  '/venues',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createVenueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid venue payload', status: 400 } });
    }
    const venue = await createVenue(req.auth!.sub, parsed.data, {
      autoApprove: Boolean(req.actingAdminId),
    });
    return res.status(201).json(venue);
  }),
);

router.get(
  '/venues/:venueId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const venue = await getVenueForOwner(req.params.venueId, req.auth!.sub);
      return res.status(200).json(venue);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.patch(
  '/venues/:venueId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateVenueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid venue payload', status: 400 } });
    }
    try {
      const venue = await updateVenue(req.params.venueId, req.auth!.sub, parsed.data);
      return res.status(200).json(venue);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /owner/turfs/:turfId/venue — retroactively group an existing
// standalone turf into a venue (locks its address to the venue's).
router.post(
  '/turfs/:turfId/venue',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = assignTurfToVenueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const turf = await assignTurfToVenue(req.params.turfId, req.auth!.sub, parsed.data.venue_id);
      return res.status(200).json(turf);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /owner/turfs — Turf Management: add a turf.
router.post(
  '/turfs',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createTurfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid turf payload', status: 400 } });
    }
    const turf = await createTurf(req.auth!.sub, parsed.data, {
      autoApprove: Boolean(req.actingAdminId),
    });
    return res.status(201).json(turf);
  }),
);

// GET/PATCH /owner/turfs/:turfId — Turf Management: view/edit a turf.
router.get(
  '/turfs/:turfId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const turf = await getTurfForOwner(req.params.turfId, req.auth!.sub);
      return res.status(200).json(turf);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.patch(
  '/turfs/:turfId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateTurfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid turf payload', status: 400 } });
    }
    try {
      const turf = await updateTurf(req.params.turfId, req.auth!.sub, parsed.data);
      return res.status(200).json(turf);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// PATCH /owner/turfs/:turfId/sound — Sound Settings.
router.patch(
  '/turfs/:turfId/sound',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setSoundSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const result = await setStadiumSoundEnabled(
        req.params.turfId,
        req.auth!.sub,
        parsed.data.stadium_sound_enabled,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /owner/turfs/:turfId/pricing — Pricing.
router.get(
  '/turfs/:turfId/pricing',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const pricing = await listPricing(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: pricing });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// PUT /owner/turfs/:turfId/pricing — Pricing.
router.put(
  '/turfs/:turfId/pricing',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setPricingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid pricing payload', status: 400 } });
    }
    try {
      const pricing = await setPricing(req.params.turfId, req.auth!.sub, parsed.data.rows);
      return res.status(200).json({ results: pricing });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /owner/turfs/:turfId/operating-hours — Operating Hours.
router.get(
  '/turfs/:turfId/operating-hours',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const hours = await listOperatingHours(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: hours });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// PUT /owner/turfs/:turfId/operating-hours — Operating Hours. Required
// before the turf is actually bookable — see setOperatingHours' comment.
router.put(
  '/turfs/:turfId/operating-hours',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setOperatingHoursSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid operating hours payload', status: 400 } });
    }
    try {
      const hours = await setOperatingHours(req.params.turfId, req.auth!.sub, parsed.data.rows);
      return res.status(200).json({ results: hours });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /owner/turfs/:turfId/copy-from — backlog A-14: copy another pitch's
// pricing/operating-hours/description/ball-types/sound-setting onto this
// one (:turfId is the target being filled in, source_turf_id in the body
// is where the details are copied from).
router.post(
  '/turfs/:turfId/copy-from',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = copyTurfDetailsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const turf = await copyTurfDetails(
        req.params.turfId,
        parsed.data.source_turf_id,
        req.auth!.sub,
      );
      return res.status(200).json(turf);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET/POST /owner/turfs/:turfId/availability-blocks — Availability Management.
router.get(
  '/turfs/:turfId/availability-blocks',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const blocks = await listAvailabilityBlocks(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: blocks });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.post(
  '/turfs/:turfId/availability-blocks',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createAvailabilityBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid block payload', status: 400 } });
    }
    try {
      const block = await createAvailabilityBlock(req.params.turfId, req.auth!.sub, parsed.data);
      return res.status(201).json(block);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.delete(
  '/availability-blocks/:blockId',
  asyncHandler(async (req: Request, res: Response) => {
    await removeAvailabilityBlock(req.params.blockId, req.auth!.sub);
    return res.status(204).send();
  }),
);

// GET /owner/bookings/today — Today's Bookings.
router.get(
  '/bookings/today',
  asyncHandler(async (req: Request, res: Response) => {
    const bookings = await getTodaysBookings(req.auth!.sub);
    return res.status(200).json({ results: bookings });
  }),
);

// GET /owner/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD[&turf_id=] — Booking
// Management across a date range (max 62 days), with customer + payment totals.
router.get(
  '/bookings',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = ownerBookingRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'from and to (YYYY-MM-DD) are required', status: 400 },
      });
    }
    try {
      const bookings = await listBookingsForOwner(req.auth!.sub, {
        from: parsed.data.from,
        to: parsed.data.to,
        turfId: parsed.data.turf_id,
      });
      return res.status(200).json({ results: bookings });
    } catch (error) {
      if (error instanceof InvalidBookingRangeError) {
        return res.status(400).json({ error: { message: error.message, status: 400 } });
      }
      throw error;
    }
  }),
);

// GET /owner/matches — Match Management.
router.get(
  '/matches',
  asyncHandler(async (req: Request, res: Response) => {
    const matches = await listMatchesForOwner(req.auth!.sub);
    return res.status(200).json({ results: matches });
  }),
);

// GET /owner/live-matches — Digital Scoreboard (PRD §12.20): every match
// at any of this owner's turfs that currently has an innings being
// scored, so the owner can pick which one to put on a given pitch's LED.
router.get(
  '/live-matches',
  asyncHandler(async (req: Request, res: Response) => {
    const matches = await listLiveMatchesForOwner(req.auth!.sub);
    return res.status(200).json({ results: matches });
  }),
);

// GET /owner/payments — Payments incl. Cash Reconciliation.
router.get(
  '/payments',
  asyncHandler(async (req: Request, res: Response) => {
    const payments = await listPaymentsForOwner(req.auth!.sub);
    return res.status(200).json({ results: payments });
  }),
);

// GET/POST /owner/turfs/:turfId/staff — Staff Management.
router.get(
  '/turfs/:turfId/staff',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const staff = await listStaffForTurf(req.params.turfId, req.auth!.sub);
      return res.status(200).json({ results: staff });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.post(
  '/turfs/:turfId/staff',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = assignStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const assignment = await assignStaff(
        req.params.turfId,
        req.auth!.sub,
        parsed.data.staff_user_id,
      );
      return res.status(201).json(assignment);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /owner/turfs/:turfId/staff/new — register a brand-new staff member
// (creates their login and assigns them to this turf in one step). Staff can
// no longer sign themselves up, so this is how they get an account.
router.post(
  '/turfs/:turfId/staff/new',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createStaffAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message:
            'A phone number (7–15 digits) and a password of at least 8 characters are required.',
          status: 400,
        },
      });
    }
    try {
      const assignment = await createStaffForTurf(req.params.turfId, req.auth!.sub, parsed.data);
      return res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof AdminUserError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /owner/analytics?from&to[&turf_id] — revenue, occupancy, peak hours and
// customer figures for this owner's turfs (PRD §9.2 / §23.1).
router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = ownerBookingRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'from and to (YYYY-MM-DD) are required', status: 400 } });
    }
    try {
      if (parsed.data.turf_id) await assertOwnsTurf(req.auth!.sub, parsed.data.turf_id);
      const result = await getAnalytics(
        { ownerId: req.auth!.sub, turfId: parsed.data.turf_id },
        parsed.data.from,
        parsed.data.to,
      );
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AnalyticsError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      throw error;
    }
  }),
);

// ---- Turf open / closed for the day (SW-5) ----

router.get(
  '/turf-status',
  asyncHandler(async (req: Request, res: Response) => {
    const results = await listTurfDayStatus({ userId: req.auth!.sub, role: 'TURF_OWNER' });
    return res.status(200).json({ results });
  }),
);

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
        { userId: req.auth!.sub, role: 'TURF_OWNER' },
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

// ---- Offers (OW-8): discount codes for the owner's own turfs ----

function offerFailure(res: Response, error: unknown) {
  if (error instanceof OfferError) {
    return res
      .status(error.status)
      .json({ error: { message: error.message, status: error.status } });
  }
  throw error;
}

router.get(
  '/offers',
  asyncHandler(async (req: Request, res: Response) => {
    return res.status(200).json({ results: await listOffers(req.auth!.sub) });
  }),
);

router.post(
  '/offers',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message: 'A code (3–30 letters, numbers, - or _) and a discount are required.',
          status: 400,
        },
      });
    }
    try {
      return res.status(201).json(await createOffer(req.auth!.sub, parsed.data));
    } catch (error) {
      return offerFailure(res, error);
    }
  }),
);

router.patch(
  '/offers/:offerId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid offer details', status: 400 } });
    }
    try {
      return res
        .status(200)
        .json(await updateOffer(req.auth!.sub, req.params.offerId, parsed.data));
    } catch (error) {
      return offerFailure(res, error);
    }
  }),
);

router.post(
  '/offers/:offerId/active',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setPromoCodeActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'is_active (true / false) is required', status: 400 } });
    }
    try {
      return res
        .status(200)
        .json(await setOfferActive(req.auth!.sub, req.params.offerId, parsed.data.is_active));
    } catch (error) {
      return offerFailure(res, error);
    }
  }),
);

router.delete(
  '/offers/:offerId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await deleteOffer(req.auth!.sub, req.params.offerId);
      return res.status(204).send();
    } catch (error) {
      return offerFailure(res, error);
    }
  }),
);

// ---- Customers (OW-5) ----

function customerFailure(res: Response, error: unknown) {
  if (error instanceof CustomerError || error instanceof MaintenanceError) {
    return res
      .status(error.status)
      .json({ error: { message: error.message, status: error.status } });
  }
  throw error;
}

router.get(
  '/customers',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = customerQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid customer filter', status: 400 } });
    }
    const results = await listCustomers(req.auth!.sub, {
      turfId: parsed.data.turf_id,
      search: parsed.data.search,
      segment: parsed.data.segment,
    });
    return res.status(200).json({ results });
  }),
);

router.get(
  '/customers/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      return res.status(200).json(await getCustomer(req.auth!.sub, req.params.userId));
    } catch (error) {
      return customerFailure(res, error);
    }
  }),
);

// ---- Maintenance tracker (OW-9) ----

router.get(
  '/maintenance',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = maintenanceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid filter', status: 400 } });
    }
    const results = await listTasks(req.auth!.sub, {
      turfId: parsed.data.turf_id,
      status: parsed.data.status,
    });
    return res.status(200).json({ results });
  }),
);

router.post(
  '/maintenance',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createMaintenanceTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'A turf and a task title are required.', status: 400 } });
    }
    try {
      return res.status(201).json(await createTask(req.auth!.sub, parsed.data));
    } catch (error) {
      return customerFailure(res, error);
    }
  }),
);

router.patch(
  '/maintenance/:taskId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateMaintenanceTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid task details', status: 400 } });
    }
    try {
      return res.status(200).json(await updateTask(req.auth!.sub, req.params.taskId, parsed.data));
    } catch (error) {
      return customerFailure(res, error);
    }
  }),
);

router.delete(
  '/maintenance/:taskId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await deleteTask(req.auth!.sub, req.params.taskId);
      return res.status(204).send();
    } catch (error) {
      return customerFailure(res, error);
    }
  }),
);

// PATCH /owner/staff/:assignmentId/permissions — switch desk actions on or off
// for one staff member (check-in, cash, scoring). Anything omitted is unchanged.
router.patch(
  '/staff/:assignmentId/permissions',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = staffPermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid permissions payload', status: 400 } });
    }
    try {
      const assignment = await updateStaffPermissions(
        req.params.assignmentId,
        req.auth!.sub,
        parsed.data,
      );
      return res.status(200).json(assignment);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /owner/staff/:assignmentId/activity — recent check-ins and cash
// collected by this staff member at this turf.
router.get(
  '/staff/:assignmentId/activity',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      return res
        .status(200)
        .json({ results: await getStaffActivity(req.params.assignmentId, req.auth!.sub) });
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

router.delete(
  '/staff/:assignmentId',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await removeStaff(req.params.assignmentId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /owner/staff/:assignmentId/review — Staff Verification, step 2
// (PRD §32.14).
router.post(
  '/staff/:assignmentId/review',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = reviewVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid review payload', status: 400 } });
    }
    try {
      const assignment = await reviewVerification(
        req.params.assignmentId,
        req.auth!.sub,
        parsed.data.decision,
        parsed.data.rejection_reason,
      );
      return res.status(200).json(assignment);
    } catch (error) {
      const handled = handleOwnerError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

export default router;
