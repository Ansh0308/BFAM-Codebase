import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  changeCaptainSchema,
  createTeamSchema,
  inviteToTeamSchema,
  openTeamsQuerySchema,
  respondToInvitationSchema,
  sendChallengeSchema,
  setOpenForChallengeSchema,
} from '../validation/schemas';
import {
  cancelChallenge,
  changeCaptain,
  createTeam,
  getTeamDetails,
  inviteToTeam,
  leaveTeam,
  listJoinRequests,
  listMyChallenges,
  listMyTeams,
  listOpenTeams,
  removeMember,
  requestToJoinTeam,
  resolvePlayerIdByBfamId,
  respondToChallenge,
  respondToInvitation,
  respondToJoinRequest,
  searchTeamsByName,
  sendChallenge,
  setOpenForChallenge,
} from '../services/teamService';
import {
  AlreadyTeamMemberError,
  ChallengeNotFoundError,
  ForbiddenActionError,
  InvalidTeamStateError,
  JoinRequestNotFoundError,
  PlayerNotFoundByBfamIdError,
  PlayerProfileNotFoundError,
  SkillRatingTooLowError,
  TeamNotFoundError,
} from '../domain/errors';

const router = Router();

function handleTeamError(error: unknown, res: Response) {
  if (
    error instanceof TeamNotFoundError ||
    error instanceof JoinRequestNotFoundError ||
    error instanceof ChallengeNotFoundError
  ) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (error instanceof ForbiddenActionError) {
    return res.status(403).json({ error: { message: error.message, status: 403 } });
  }
  if (error instanceof PlayerProfileNotFoundError) {
    return res.status(422).json({ error: { message: error.message, status: 422 } });
  }
  if (error instanceof PlayerNotFoundByBfamIdError) {
    return res.status(404).json({ error: { message: error.message, status: 404 } });
  }
  if (
    error instanceof AlreadyTeamMemberError ||
    error instanceof InvalidTeamStateError ||
    error instanceof SkillRatingTooLowError
  ) {
    return res.status(409).json({ error: { message: error.message, status: 409 } });
  }
  return null;
}

// POST /teams — Create Team (PRD §12.3): creates the team and makes the
// caller its Captain atomically.
router.post(
  '/',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid team payload', status: 400, details: parsed.error.flatten() },
      });
    }
    try {
      const team = await createTeam(req.auth!.sub, parsed.data);
      return res.status(201).json(team);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /teams/mine — My Teams.
router.get(
  '/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const teams = await listMyTeams(req.auth!.sub);
      return res.status(200).json({ results: teams });
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /teams/open — Open Teams vacancy discovery (PRD §12.4). Filter by
// skill level and location only — map view is out of scope, same as Turf
// Discovery (module 2.3).
router.get(
  '/open',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = openTeamsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid filter parameters', status: 400 } });
    }
    const teams = await listOpenTeams(parsed.data);
    return res.status(200).json({ results: teams });
  }),
);

// GET /teams/search?q= — backlog G-20: the Opponent Team picker in Create
// Match, searching every active team by name (not just ones open for new
// players — you can challenge a closed team). A blank/missing query
// returns no results rather than the whole table.
router.get(
  '/search',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const teams = await searchTeamsByName(q);
    return res.status(200).json({ results: teams });
  }),
);

// GET /teams/challenges/mine — backlog B-13: every challenge involving a
// team the caller captains, either side. A 2-segment literal path, so it
// never collides with /:teamId regardless of registration order.
router.get(
  '/challenges/mine',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const challenges = await listMyChallenges(req.auth!.sub);
    return res.status(200).json({ results: challenges });
  }),
);

// GET /teams/:teamId — Team Details.
router.get(
  '/:teamId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const team = await getTeamDetails(req.params.teamId);
      return res.status(200).json(team);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/:teamId/invitations — invite a player (captain-only).
router.post(
  '/:teamId/invitations',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = inviteToTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid invitation payload', status: 400 } });
    }
    try {
      const playerId =
        parsed.data.player_id ?? (await resolvePlayerIdByBfamId(parsed.data.bfam_id!));
      const invitation = await inviteToTeam(req.params.teamId, req.auth!.sub, playerId);
      return res.status(201).json(invitation);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/invitations/:invitationId/respond — the invited player
// accepts or rejects.
router.post(
  '/invitations/:invitationId/respond',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = respondToInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid response payload', status: 400 } });
    }
    try {
      const result = await respondToInvitation(
        req.params.invitationId,
        req.auth!.sub,
        parsed.data.accept,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// DELETE /teams/:teamId/members/:playerId — remove a player (captain-only).
router.delete(
  '/:teamId/members/:playerId',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await removeMember(req.params.teamId, req.auth!.sub, req.params.playerId);
      return res.status(204).send();
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/:teamId/leave — a member leaves on their own.
router.post(
  '/:teamId/leave',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await leaveTeam(req.params.teamId, req.auth!.sub);
      return res.status(204).send();
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/:teamId/captain — Change Captain (PRD §12.3 / §15): a single
// atomic transaction, never a window with zero or two captains.
router.post(
  '/:teamId/captain',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = changeCaptainSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { message: 'Invalid captain-change payload', status: 400 } });
    }
    try {
      await changeCaptain(req.params.teamId, req.auth!.sub, parsed.data.new_captain_player_id);
      return res.status(204).send();
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/:teamId/join-requests — Join Team Request (PRD §12.4).
router.post(
  '/:teamId/join-requests',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await requestToJoinTeam(req.params.teamId, req.auth!.sub);
      return res.status(201).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// GET /teams/:teamId/join-requests — pending requests (captain-only).
router.get(
  '/:teamId/join-requests',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const requests = await listJoinRequests(req.params.teamId, req.auth!.sub);
      return res.status(200).json({ results: requests });
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/join-requests/:requestId/respond — captain approves/rejects.
router.post(
  '/join-requests/:requestId/respond',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = respondToInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid response payload', status: 400 } });
    }
    try {
      const result = await respondToJoinRequest(
        req.params.requestId,
        req.auth!.sub,
        parsed.data.accept,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/:teamId/open-for-challenge — backlog B-13: captain toggles
// whether other teams can challenge this one.
router.post(
  '/:teamId/open-for-challenge',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = setOpenForChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid payload', status: 400 } });
    }
    try {
      const result = await setOpenForChallenge(
        req.params.teamId,
        req.auth!.sub,
        parsed.data.is_open_for_challenge,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/:teamId/challenges — backlog B-13: this team's captain
// challenges another team (challenged_team_id in the body) to a match.
router.post(
  '/:teamId/challenges',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = sendChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid challenge payload', status: 400 } });
    }
    try {
      const result = await sendChallenge(
        req.params.teamId,
        req.auth!.sub,
        parsed.data.challenged_team_id,
      );
      return res.status(201).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/challenges/:challengeId/respond — the challenged team's
// captain accepts or declines.
router.post(
  '/challenges/:challengeId/respond',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = respondToInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid response payload', status: 400 } });
    }
    try {
      const result = await respondToChallenge(
        req.params.challengeId,
        req.auth!.sub,
        parsed.data.accept,
      );
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

// POST /teams/challenges/:challengeId/cancel — the challenger withdraws a
// still-pending challenge.
router.post(
  '/challenges/:challengeId/cancel',
  authenticateJwt,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await cancelChallenge(req.params.challengeId, req.auth!.sub);
      return res.status(200).json(result);
    } catch (error) {
      const handled = handleTeamError(error, res);
      if (handled) return handled;
      throw error;
    }
  }),
);

export default router;
