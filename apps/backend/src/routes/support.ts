import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createComplaintSchema,
  createInjuryReportSchema,
  createMatchDisputeSchema,
  updateTicketStatusSchema,
} from '../validation/schemas';
import {
  createComplaint,
  createInjuryReport,
  createMatchDispute,
  getTicket,
  listMyTickets,
  updateTicketStatus,
} from '../services/supportService';
import {
  ForbiddenActionError,
  InvalidTicketStatusTransitionError,
  SupportTicketNotFoundError,
  WaiverNotAcceptedError,
} from '../domain/errors';

const router = Router();

function handleSupportError(error: unknown, res: Response) {
  if (error instanceof SupportTicketNotFoundError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof WaiverNotAcceptedError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof InvalidTicketStatusTransitionError) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  return null;
}

// POST /support/complaints — Submit Complaint (PRD §12.57).
router.post(
  '/complaints',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid complaint payload', status: 400 } });
    }
    const ticket = await createComplaint(req.auth!.sub, {
      category: parsed.data.category,
      description: parsed.data.description,
      relatedEntityType: parsed.data.related_entity_type,
      relatedEntityId: parsed.data.related_entity_id,
    });
    return res.status(201).json(ticket);
  }),
);

// POST /support/disputes — in-app dispute flow for scoring/result
// disagreements (PRD §32.2), linked from the Match Result/Scorecard
// screens (module 2.8).
router.post(
  '/disputes',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createMatchDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid dispute payload', status: 400 } });
    }
    try {
      const ticket = await createMatchDispute(
        req.auth!.sub,
        parsed.data.match_id,
        parsed.data.description,
      );
      return res.status(201).json(ticket);
    } catch (error) {
      const handled = handleSupportError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /support/injury-reports — injury report flow (PRD §32.9), gated on
// the liability waiver (see supportService.ts for what that gate means
// today).
router.post(
  '/injury-reports',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createInjuryReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid injury report payload', status: 400 } });
    }
    try {
      const ticket = await createInjuryReport(
        req.auth!.sub,
        parsed.data.description,
        parsed.data.match_id,
      );
      return res.status(201).json(ticket);
    } catch (error) {
      const handled = handleSupportError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /support/tickets — Complaint Status (PRD §12.57): every ticket the
// caller has raised.
router.get(
  '/tickets',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const tickets = await listMyTickets(req.auth!.sub);
    return res.status(200).json({ results: tickets });
  }),
);

router.get(
  '/tickets/:ticketId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const ticket = await getTicket(req.params.ticketId, req.auth!.sub);
      return res.status(200).json(ticket);
    } catch (error) {
      const handled = handleSupportError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /support/tickets/:ticketId/status — advances a ticket through the
// state machine (module 2.13's dispute-flow state-transitions
// requirement). Admin-only for MVP — no dedicated support-staff role
// exists yet.
router.post(
  '/tickets/:ticketId/status',
  authenticateJwt,
  requireRoles('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateTicketStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid status payload', status: 400 } });
    }
    try {
      const ticket = await updateTicketStatus(
        req.params.ticketId,
        req.auth!.sub,
        parsed.data.status,
      );
      return res.status(200).json(ticket);
    } catch (error) {
      const handled = handleSupportError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

export default router;
