import { Router, Request, Response } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createTournamentSchema,
  tournamentListQuerySchema,
  tournamentPaymentSchema,
  tournamentResultSchema,
  tournamentReviewSchema,
  tournamentScheduleSchema,
  tournamentSeedsSchema,
  tournamentTeamSchema,
  updateTournamentSchema,
} from '../validation/schemas';
import {
  TournamentError,
  addTeam,
  cancelTournament,
  createTournament,
  deleteTournament,
  getTournament,
  listTournaments,
  markEntryPaid,
  openRegistration,
  recordResult,
  registerTeam,
  removeEntry,
  reopenFixture,
  reviewEntry,
  scheduleFixture,
  setSeeds,
  startKnockout,
  startTournament,
  updateTournament,
  type Actor,
} from '../services/tournamentService';

const router = Router();
router.use(authenticateJwt);

const actorOf = (req: Request): Actor => ({
  userId: req.auth!.sub,
  role: req.auth!.role as Actor['role'],
});
const bad = (res: Response, message: string) =>
  res.status(400).json({ error: { message, status: 400 } });

// Maps TournamentError to its HTTP status; anything else is a real server error.
function run(handler: (req: Request, res: Response) => Promise<unknown>) {
  return asyncHandler(async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof TournamentError) {
        return res
          .status(error.status)
          .json({ error: { message: error.message, status: error.status } });
      }
      throw error;
    }
  });
}

const managers = requireRoles('ADMIN', 'TURF_OWNER');

// Everyone signed in can browse tournaments (drafts are hidden from them).
router.get(
  '/',
  run(async (req, res) => {
    const parsed = tournamentListQuerySchema.safeParse(req.query);
    if (!parsed.success) return bad(res, 'Invalid status filter');
    res.status(200).json({ results: await listTournaments(actorOf(req), parsed.data) });
  }),
);

router.post(
  '/',
  managers,
  run(async (req, res) => {
    const parsed = createTournamentSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'Check the tournament details and try again.');
    res.status(201).json(await createTournament(actorOf(req), parsed.data));
  }),
);

// ---- entries & fixtures (declared before /:id so the paths stay unambiguous) ----

router.post(
  '/entries/:entryId/review',
  managers,
  run(async (req, res) => {
    const parsed = tournamentReviewSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'decision must be APPROVED or REJECTED');
    res.status(200).json(await reviewEntry(actorOf(req), req.params.entryId, parsed.data.decision));
  }),
);

router.post(
  '/entries/:entryId/payment',
  managers,
  run(async (req, res) => {
    const parsed = tournamentPaymentSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'paid (true / false) is required');
    res
      .status(200)
      .json(
        await markEntryPaid(
          actorOf(req),
          req.params.entryId,
          parsed.data.reference ?? null,
          parsed.data.paid,
        ),
      );
  }),
);

// Organiser removes a team, or a captain withdraws their own.
router.delete(
  '/entries/:entryId',
  run(async (req, res) => {
    await removeEntry(actorOf(req), req.params.entryId);
    res.status(204).send();
  }),
);

router.patch(
  '/fixtures/:fixtureId',
  managers,
  run(async (req, res) => {
    const parsed = tournamentScheduleSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'Invalid schedule');
    await scheduleFixture(
      actorOf(req),
      req.params.fixtureId,
      parsed.data.scheduled_at ?? null,
      parsed.data.venue_note ?? null,
    );
    res.status(204).send();
  }),
);

router.post(
  '/fixtures/:fixtureId/result',
  managers,
  run(async (req, res) => {
    const parsed = tournamentResultSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'Check the result and try again.');
    await recordResult(actorOf(req), req.params.fixtureId, parsed.data);
    res.status(204).send();
  }),
);

router.post(
  '/fixtures/:fixtureId/reopen',
  managers,
  run(async (req, res) => {
    await reopenFixture(actorOf(req), req.params.fixtureId);
    res.status(204).send();
  }),
);

// ---- one tournament ----

router.get(
  '/:id',
  run(async (req, res) => {
    res.status(200).json(await getTournament(actorOf(req), req.params.id));
  }),
);

router.patch(
  '/:id',
  managers,
  run(async (req, res) => {
    const parsed = updateTournamentSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'Check the tournament details and try again.');
    res.status(200).json(await updateTournament(actorOf(req), req.params.id, parsed.data));
  }),
);

router.delete(
  '/:id',
  managers,
  run(async (req, res) => {
    await deleteTournament(actorOf(req), req.params.id);
    res.status(204).send();
  }),
);

router.post(
  '/:id/open',
  managers,
  run(async (req, res) => {
    res.status(200).json(await openRegistration(actorOf(req), req.params.id));
  }),
);
router.post(
  '/:id/cancel',
  managers,
  run(async (req, res) => {
    res.status(200).json(await cancelTournament(actorOf(req), req.params.id));
  }),
);
router.post(
  '/:id/start',
  managers,
  run(async (req, res) => {
    res.status(200).json(await startTournament(actorOf(req), req.params.id));
  }),
);
router.post(
  '/:id/knockout',
  managers,
  run(async (req, res) => {
    res.status(200).json(await startKnockout(actorOf(req), req.params.id));
  }),
);

router.put(
  '/:id/seeds',
  managers,
  run(async (req, res) => {
    const parsed = tournamentSeedsSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'order must be a list of entry ids');
    await setSeeds(actorOf(req), req.params.id, parsed.data.order);
    res.status(204).send();
  }),
);

// Organiser adds a team directly (approved straight away).
router.post(
  '/:id/teams',
  managers,
  run(async (req, res) => {
    const parsed = tournamentTeamSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'team_id is required');
    res.status(201).json(await addTeam(actorOf(req), req.params.id, parsed.data.team_id));
  }),
);

// A team captain enters their team; it waits for the organiser's approval.
router.post(
  '/:id/register',
  run(async (req, res) => {
    const parsed = tournamentTeamSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'team_id is required');
    res.status(201).json(await registerTeam(actorOf(req), req.params.id, parsed.data.team_id));
  }),
);

export default router;
