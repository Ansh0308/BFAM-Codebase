import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  checkInSchema,
  confirmPlayingXiSchema,
  createMatchSchema,
  inviteReplacementSchema,
  inviteToMatchSchema,
  recordTossSchema,
  respondToMatchInvitationSchema,
  updateAttendanceSchema,
} from '../validation/schemas';
import {
  completeIntro,
  confirmPlayingXi,
  getIntroContext,
  recordToss,
  startIntro,
} from '../services/matchIntroService';
import { getActiveViewerCount, getTotalViews } from '../services/presenceService';
import {
  acceptReplacement,
  checkInWithCode,
  createMatch,
  getCheckInCode,
  getGameRoom,
  getRebookInfo,
  inviteReplacement,
  inviteToMatch,
  joinMatchViaLink,
  listMyMatches,
  respondToMatchInvitation,
  respondToMatchInvitationByMatch,
  setPlayerAttendance,
  suggestReplacements,
  updateMyAttendance,
  vacateSpot,
} from '../services/matchService';
import {
  ForbiddenActionError,
  InvalidCheckInCodeError,
  InvalidMatchStateError,
  MatchAlreadyExistsForBookingError,
  MatchIntroNotFoundError,
  MatchInvitationNotFoundError,
  MatchNotCompletedError,
  MatchNotFoundError,
  PlayerProfileNotFoundError,
  ReplacementNotFoundError,
  StaffNotVerifiedError,
} from '../domain/errors';

const router = Router();

function handleMatchError(error: unknown, res: Response) {
  if (
    error instanceof MatchNotFoundError ||
    error instanceof MatchInvitationNotFoundError ||
    error instanceof ReplacementNotFoundError ||
    error instanceof MatchIntroNotFoundError
  ) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError || error instanceof StaffNotVerifiedError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof PlayerProfileNotFoundError) {
    return res.status(422).json({ error: { message: error.message, status: 422 } });
  }
  if (
    error instanceof InvalidMatchStateError ||
    error instanceof MatchAlreadyExistsForBookingError ||
    error instanceof InvalidCheckInCodeError ||
    error instanceof MatchNotCompletedError
  ) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  return null;
}

// POST /matches — Create Game (PRD §12.9).
router.post(
  '/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid match payload', status: 400, details: parsed.error.flatten() },
      });
    }
    try {
      const match = await createMatch(req.auth!.sub, parsed.data);
      return res.status(201).json(match);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/mine — Matches tab list.
router.get(
  '/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const matches = await listMyMatches(req.auth!.sub);
    return res.status(200).json({ results: matches });
  }),
);

// GET /matches/:matchId/viewers — initial paint for the "N Watching Live"
// badge (module 2.9, PRD §12.62); the socket 'match:viewer_count' event
// keeps it live after that.
router.get(
  '/:matchId/viewers',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const [active, total] = await Promise.all([
      getActiveViewerCount(req.params.matchId),
      getTotalViews(req.params.matchId),
    ]);
    return res.status(200).json({ active, total });
  }),
);

// GET /matches/:matchId — Game Room (PRD §12.10).
router.get(
  '/:matchId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const gameRoom = await getGameRoom(req.params.matchId, req.auth!.sub);
      return res.status(200).json(gameRoom);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/invitations — Invite Players (PRD §12.11).
router.post(
  '/:matchId/invitations',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = inviteToMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid invitation payload', status: 400 } });
    }
    try {
      const invitation = await inviteToMatch(
        req.params.matchId,
        req.auth!.sub,
        parsed.data.player_id,
      );
      return res.status(201).json(invitation);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/join — share-link / WhatsApp-share invite
// landing action (PRD §12.11).
router.post(
  '/:matchId/join',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await joinMatchViaLink(req.params.matchId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/invitations/:invitationId/respond — Player Confirmation
// flow (PRD §12.12): Confirmed / Maybe / Can't Play.
router.post(
  '/invitations/:invitationId/respond',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = respondToMatchInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid response payload', status: 400 } });
    }
    try {
      const result = await respondToMatchInvitation(
        req.params.invitationId,
        req.auth!.sub,
        parsed.data.response,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/respond — convenience wrapper for the Game Room
// screen, which only has the matchId, not an invitation_id.
router.post(
  '/:matchId/respond',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = respondToMatchInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid response payload', status: 400 } });
    }
    try {
      const result = await respondToMatchInvitationByMatch(
        req.params.matchId,
        req.auth!.sub,
        parsed.data.response,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/attendance/me — self-service Running Late /
// Checked In (PRD §12.14).
router.post(
  '/:matchId/attendance/me',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateAttendanceSchema.safeParse(req.body);
    if (
      !parsed.success ||
      !['RUNNING_LATE', 'CHECKED_IN'].includes(parsed.data.attendance_status)
    ) {
      return res.status(400).json({
        error: {
          message: 'You can only set your own status to Running Late or Checked In.',
          status: 400,
        },
      });
    }
    try {
      await updateMyAttendance(
        req.params.matchId,
        req.auth!.sub,
        parsed.data.attendance_status as 'RUNNING_LATE' | 'CHECKED_IN',
      );
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/attendance/:playerId — organizer/scorer setting
// any player's attendance, including No-Show (PRD §12.14).
router.post(
  '/:matchId/attendance/:playerId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid attendance payload', status: 400 } });
    }
    try {
      await setPlayerAttendance(
        req.params.matchId,
        req.auth!.sub,
        req.params.playerId,
        parsed.data.attendance_status,
      );
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/:matchId/check-in-code — organizer/scorer displays this as
// a QR (PRD §12.48).
router.get(
  '/:matchId/check-in-code',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await getCheckInCode(req.params.matchId, req.auth!.sub);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/check-in — a player scans the QR and self-checks-in.
router.post(
  '/:matchId/check-in',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid check-in payload', status: 400 } });
    }
    try {
      await checkInWithCode(req.params.matchId, req.auth!.sub, parsed.data.code);
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/players/:playerId/vacate — Player Replacement
// flow, step 1: open a vacancy (PRD §12.15).
router.post(
  '/:matchId/players/:playerId/vacate',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await vacateSpot(req.params.matchId, req.auth!.sub, req.params.playerId);
      return res.status(201).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/replacements/:replacementId/suggestions — step 2.
router.get(
  '/replacements/:replacementId/suggestions',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const suggestions = await suggestReplacements(req.params.replacementId, req.auth!.sub);
      return res.status(200).json({ results: suggestions });
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/replacements/:replacementId/invite — step 3.
router.post(
  '/replacements/:replacementId/invite',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = inviteReplacementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid replacement invite payload', status: 400 } });
    }
    try {
      await inviteReplacement(req.params.replacementId, req.auth!.sub, parsed.data.player_id);
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/replacements/:replacementId/accept — step 4.
router.post(
  '/replacements/:replacementId/accept',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await acceptReplacement(req.params.replacementId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/start — Game Room's "Start Match" action (PRD
// §12.61 requirement 1). Creates the match_intro record and broadcasts the
// COUNTDOWN stage to every connected viewer. Module 2.8 (Live Scoring) is
// what the intro sequence eventually hands off to — that handoff is a stub
// only (see /:matchId/intro/complete below), per this module's scope.
router.post(
  '/:matchId/start',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await startIntro(req.params.matchId, req.auth!.sub);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/:matchId/intro — current intro state + live-derived
// Playing XI (module 2.7).
router.get(
  '/:matchId/intro',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await getIntroContext(req.params.matchId);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/intro/confirm-xi — Playing XI reveal
// confirmation, per side.
router.post(
  '/:matchId/intro/confirm-xi',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = confirmPlayingXiSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const result = await confirmPlayingXi(req.params.matchId, req.auth!.sub, parsed.data.side);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/intro/toss — toss result capture (PRD §12.61
// requirement 5).
router.post(
  '/:matchId/intro/toss',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = recordTossSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid toss payload', status: 400 } });
    }
    try {
      const result = await recordToss(
        req.params.matchId,
        req.auth!.sub,
        parsed.data.toss_winner_match_team_id,
        parsed.data.decision,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /matches/:matchId/intro/complete — the sequence's final stage;
// hands off to Live Scoring (module 2.8), which is a stub only here.
router.post(
  '/:matchId/intro/complete',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await completeIntro(req.params.matchId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /matches/:matchId/rebook — Rebook Same Players (module 2.10, PRD
// §12.44): everything Create Game needs to start again with the same turf,
// format, and roster.
router.get(
  '/:matchId/rebook',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const info = await getRebookInfo(req.params.matchId, req.auth!.sub);
      return res.status(200).json(info);
    } catch (error) {
      const handled = handleMatchError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

export default router;
