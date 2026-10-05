import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  ballsFromOvers,
  computePointsTable,
  generateKnockout,
  generateRoundRobin,
  isBye,
  knockoutQualifiers,
  oversFromBalls,
  roundName,
  type FixtureSeed,
} from '../domain/tournamentEngine';
import { writeAuditLog } from './auditLogService';

// Tournaments (PRD §9.1 / §9.2). Organisers (admin, or a turf owner for their
// own turf) create an event, teams enter (captain applies, or the organiser
// adds a team), the organiser approves and starts it, and fixtures are
// generated: a round-robin league, a knockout bracket, or a league followed by
// a knockout. Results are entered by the organiser and feed the points table.
//
// Entry fees are tracked per team (UNPAID / PAID with a reference) and marked
// paid by the organiser; taking the fee online through the payment gateway is
// not wired yet.

export class TournamentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TournamentError';
  }
}

export interface Actor {
  userId: string;
  role: 'ADMIN' | 'TURF_OWNER' | 'TURF_STAFF' | 'PLAYER';
}

type Format = 'LEAGUE' | 'KNOCKOUT' | 'LEAGUE_KNOCKOUT';
type TStatus = 'DRAFT' | 'REGISTRATION_OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface TournamentRow {
  tournament_id: string;
  name: string;
  description: string | null;
  format: Format;
  organiser_id: string;
  turf_id: string | null;
  overs_per_innings: number;
  entry_fee: string | number;
  min_teams: number;
  max_teams: number;
  double_round: number | boolean;
  start_date: string | Date | null;
  registration_deadline: string | Date | null;
  status: TStatus;
  champion_entry_id: string | null;
  created_at: Date;
}

interface EntryRow {
  entry_id: string;
  tournament_id: string;
  team_id: string;
  registered_by: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  payment_status: 'NOT_REQUIRED' | 'UNPAID' | 'PAID';
  payment_reference: string | null;
  paid_at: Date | null;
  seed: number | null;
  registered_at: Date;
}

interface FixtureRow {
  fixture_id: string;
  tournament_id: string;
  stage: 'LEAGUE' | 'KNOCKOUT';
  round_number: number;
  match_number: number;
  team_a_entry_id: string | null;
  team_b_entry_id: string | null;
  next_match_number: number | null;
  next_slot: 'A' | 'B' | null;
  scheduled_at: Date | null;
  venue_note: string | null;
  status: 'SCHEDULED' | 'COMPLETED';
  result_type: 'WIN' | 'TIE' | 'NO_RESULT' | null;
  winner_entry_id: string | null;
  team_a_runs: number | null;
  team_a_wickets: number | null;
  team_a_balls: number | null;
  team_b_runs: number | null;
  team_b_wickets: number | null;
  team_b_balls: number | null;
  match_id: string | null;
}

const q = <T extends object>(sql: string, replacements: Record<string, unknown> = {}) =>
  sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements });

const isAdmin = (a: Actor) => a.role === 'ADMIN';

// ---- loading & permissions --------------------------------------------------

async function loadTournament(id: string): Promise<TournamentRow> {
  const [row] = await q<TournamentRow>(
    'SELECT * FROM tournaments WHERE tournament_id = :id AND deleted_at IS NULL',
    { id },
  );
  if (!row) throw new TournamentError('Tournament not found.', 404);
  return row;
}

function assertCanManage(t: TournamentRow, actor: Actor) {
  if (isAdmin(actor) || t.organiser_id === actor.userId) return;
  throw new TournamentError('Only the organiser can change this tournament.', 403);
}

async function ownsTurf(userId: string, turfId: string): Promise<boolean> {
  const rows = await q<{ turf_id: string }>(
    'SELECT turf_id FROM turfs WHERE turf_id = :turfId AND owner_id = :userId AND deleted_at IS NULL',
    { turfId, userId },
  );
  return rows.length > 0;
}

async function canView(t: TournamentRow, actor: Actor): Promise<boolean> {
  if (t.status !== 'DRAFT') return true;
  if (isAdmin(actor) || t.organiser_id === actor.userId) return true;
  return !!t.turf_id && actor.role === 'TURF_OWNER' && (await ownsTurf(actor.userId, t.turf_id));
}

// ---- create / update --------------------------------------------------------

export interface TournamentInput {
  name: string;
  description?: string | null;
  format: Format;
  turf_id?: string | null;
  overs_per_innings: number;
  entry_fee: number;
  min_teams: number;
  max_teams: number;
  double_round?: boolean;
  start_date?: string | null;
  registration_deadline?: string | null;
}

export async function createTournament(actor: Actor, input: TournamentInput) {
  if (actor.role !== 'ADMIN' && actor.role !== 'TURF_OWNER') {
    throw new TournamentError('Only an admin or a turf owner can create a tournament.', 403);
  }
  if (input.min_teams > input.max_teams) {
    throw new TournamentError('The minimum number of teams cannot exceed the maximum.', 400);
  }
  if (actor.role === 'TURF_OWNER') {
    if (!input.turf_id) throw new TournamentError('Choose which of your turfs hosts it.', 400);
    if (!(await ownsTurf(actor.userId, input.turf_id))) {
      throw new TournamentError('You can only run tournaments at your own turfs.', 403);
    }
  } else if (input.turf_id) {
    const [turf] = await q<{ turf_id: string }>(
      'SELECT turf_id FROM turfs WHERE turf_id = :id AND deleted_at IS NULL',
      { id: input.turf_id },
    );
    if (!turf) throw new TournamentError('That turf was not found.', 404);
  }

  const id = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('tournaments', [
    {
      tournament_id: id,
      name: input.name,
      description: input.description ?? null,
      format: input.format,
      organiser_id: actor.userId,
      turf_id: input.turf_id ?? null,
      overs_per_innings: input.overs_per_innings,
      entry_fee: input.entry_fee,
      min_teams: input.min_teams,
      max_teams: input.max_teams,
      double_round: Boolean(input.double_round),
      start_date: input.start_date ?? null,
      registration_deadline: input.registration_deadline ?? null,
      status: 'DRAFT',
      champion_entry_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ]);
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_CREATED',
    resourceType: 'tournament',
    resourceId: id,
    afterData: { name: input.name, format: input.format },
  });
  return loadTournament(id);
}

export async function updateTournament(actor: Actor, id: string, input: Partial<TournamentInput>) {
  const t = await loadTournament(id);
  assertCanManage(t, actor);
  if (t.status !== 'DRAFT' && t.status !== 'REGISTRATION_OPEN') {
    throw new TournamentError('A tournament cannot be edited once it has started.', 409);
  }
  const changes: Record<string, unknown> = {};
  for (const key of [
    'name',
    'description',
    'format',
    'overs_per_innings',
    'entry_fee',
    'min_teams',
    'max_teams',
    'double_round',
    'start_date',
    'registration_deadline',
  ] as const) {
    if (input[key] !== undefined) changes[key] = input[key];
  }
  const min = (changes.min_teams as number | undefined) ?? t.min_teams;
  const max = (changes.max_teams as number | undefined) ?? t.max_teams;
  if (min > max)
    throw new TournamentError('The minimum number of teams cannot exceed the maximum.', 400);
  if (Object.keys(changes).length === 0) return t;
  await sequelize
    .getQueryInterface()
    .bulkUpdate('tournaments', { ...changes, updated_at: new Date() }, { tournament_id: id });
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_UPDATED',
    resourceType: 'tournament',
    resourceId: id,
    afterData: changes,
  });
  return loadTournament(id);
}

async function setStatus(id: string, status: TStatus, extra: Record<string, unknown> = {}) {
  await sequelize
    .getQueryInterface()
    .bulkUpdate('tournaments', { status, ...extra, updated_at: new Date() }, { tournament_id: id });
}

export async function openRegistration(actor: Actor, id: string) {
  const t = await loadTournament(id);
  assertCanManage(t, actor);
  if (t.status !== 'DRAFT')
    throw new TournamentError('Registration is already open or closed.', 409);
  await setStatus(id, 'REGISTRATION_OPEN');
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_REGISTRATION_OPENED',
    resourceType: 'tournament',
    resourceId: id,
  });
  return loadTournament(id);
}

export async function cancelTournament(actor: Actor, id: string) {
  const t = await loadTournament(id);
  assertCanManage(t, actor);
  if (t.status === 'COMPLETED' || t.status === 'CANCELLED') {
    throw new TournamentError('This tournament is already finished.', 409);
  }
  await setStatus(id, 'CANCELLED');
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_CANCELLED',
    resourceType: 'tournament',
    resourceId: id,
  });
  return loadTournament(id);
}

export async function deleteTournament(actor: Actor, id: string) {
  const t = await loadTournament(id);
  assertCanManage(t, actor);
  if (t.status !== 'DRAFT' && t.status !== 'CANCELLED') {
    throw new TournamentError('Only a draft or cancelled tournament can be deleted.', 409);
  }
  await sequelize
    .getQueryInterface()
    .bulkUpdate('tournaments', { deleted_at: new Date() }, { tournament_id: id });
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_DELETED',
    resourceType: 'tournament',
    resourceId: id,
  });
}

// ---- entries ------------------------------------------------------------------

async function loadEntry(entryId: string): Promise<EntryRow> {
  const [row] = await q<EntryRow>('SELECT * FROM tournament_teams WHERE entry_id = :entryId', {
    entryId,
  });
  if (!row) throw new TournamentError('Entry not found.', 404);
  return row;
}

async function approvedCount(tournamentId: string): Promise<number> {
  const [row] = await q<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM tournament_teams WHERE tournament_id = :tournamentId AND status = 'APPROVED'",
    { tournamentId },
  );
  return Number(row?.n ?? 0);
}

async function insertEntry(
  t: TournamentRow,
  teamId: string,
  registeredBy: string,
  status: 'PENDING' | 'APPROVED',
) {
  const [team] = await q<{ team_id: string }>(
    "SELECT team_id FROM teams WHERE team_id = :teamId AND team_status = 'ACTIVE' AND deleted_at IS NULL",
    { teamId },
  );
  if (!team) throw new TournamentError('That team was not found or is not active.', 404);

  const [existing] = await q<EntryRow>(
    'SELECT * FROM tournament_teams WHERE tournament_id = :tid AND team_id = :teamId',
    { tid: t.tournament_id, teamId },
  );
  if (existing && existing.status !== 'WITHDRAWN' && existing.status !== 'REJECTED') {
    throw new TournamentError('That team has already entered this tournament.', 409);
  }

  const fee = Number(t.entry_fee);
  const entryId = existing?.entry_id ?? randomUUID();
  const row = {
    status,
    payment_status: fee > 0 ? 'UNPAID' : 'NOT_REQUIRED',
    payment_reference: null,
    paid_at: null,
    registered_by: registeredBy,
    registered_at: new Date(),
  };
  if (existing) {
    await sequelize.getQueryInterface().bulkUpdate('tournament_teams', row, { entry_id: entryId });
  } else {
    await sequelize
      .getQueryInterface()
      .bulkInsert('tournament_teams', [
        { entry_id: entryId, tournament_id: t.tournament_id, team_id: teamId, seed: null, ...row },
      ]);
  }
  return loadEntry(entryId);
}

// A team captain applies to a tournament that is taking entries.
export async function registerTeam(actor: Actor, tournamentId: string, teamId: string) {
  const t = await loadTournament(tournamentId);
  if (t.status !== 'REGISTRATION_OPEN') {
    throw new TournamentError('This tournament is not taking entries.', 409);
  }
  if (t.registration_deadline) {
    const deadline = new Date(`${String(t.registration_deadline).slice(0, 10)}T23:59:59`);
    if (deadline < new Date())
      throw new TournamentError('Registration for this tournament has closed.', 409);
  }
  const captain = await q<{ team_id: string }>(
    `SELECT tm.team_id FROM team_members tm JOIN players p ON p.player_id = tm.player_id
     WHERE tm.team_id = :teamId AND p.user_id = :userId
       AND tm.role_in_team = 'CAPTAIN' AND tm.membership_status = 'ACTIVE'`,
    { teamId, userId: actor.userId },
  );
  if (captain.length === 0) throw new TournamentError('Only the team’s captain can enter it.', 403);
  const entry = await insertEntry(t, teamId, actor.userId, 'PENDING');
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_TEAM_REGISTERED',
    resourceType: 'tournament',
    resourceId: tournamentId,
    afterData: { team_id: teamId },
  });
  return entry;
}

// The organiser adds a team directly (already approved).
export async function addTeam(actor: Actor, tournamentId: string, teamId: string) {
  const t = await loadTournament(tournamentId);
  assertCanManage(t, actor);
  if (t.status !== 'DRAFT' && t.status !== 'REGISTRATION_OPEN') {
    throw new TournamentError('Teams can’t be added once the tournament has started.', 409);
  }
  if ((await approvedCount(tournamentId)) >= t.max_teams) {
    throw new TournamentError('This tournament is full.', 409);
  }
  return insertEntry(t, teamId, actor.userId, 'APPROVED');
}

export async function reviewEntry(
  actor: Actor,
  entryId: string,
  decision: 'APPROVED' | 'REJECTED',
) {
  const entry = await loadEntry(entryId);
  const t = await loadTournament(entry.tournament_id);
  assertCanManage(t, actor);
  if (t.status !== 'DRAFT' && t.status !== 'REGISTRATION_OPEN') {
    throw new TournamentError('Entries can’t be reviewed once the tournament has started.', 409);
  }
  if (entry.status === 'WITHDRAWN') throw new TournamentError('That team has withdrawn.', 409);
  if (decision === 'APPROVED' && entry.status !== 'APPROVED') {
    if ((await approvedCount(t.tournament_id)) >= t.max_teams) {
      throw new TournamentError('This tournament is full.', 409);
    }
  }
  await sequelize
    .getQueryInterface()
    .bulkUpdate('tournament_teams', { status: decision }, { entry_id: entryId });
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: `TOURNAMENT_ENTRY_${decision}`,
    resourceType: 'tournament',
    resourceId: t.tournament_id,
    afterData: { entry_id: entryId },
  });
  return loadEntry(entryId);
}

export async function removeEntry(actor: Actor, entryId: string) {
  const entry = await loadEntry(entryId);
  const t = await loadTournament(entry.tournament_id);
  const isManager = isAdmin(actor) || t.organiser_id === actor.userId;
  if (!isManager && entry.registered_by !== actor.userId) {
    throw new TournamentError('You can’t change this entry.', 403);
  }
  if (t.status !== 'DRAFT' && t.status !== 'REGISTRATION_OPEN') {
    throw new TournamentError('A team can’t leave once the tournament has started.', 409);
  }
  await sequelize
    .getQueryInterface()
    .bulkUpdate('tournament_teams', { status: 'WITHDRAWN', seed: null }, { entry_id: entryId });
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_ENTRY_WITHDRAWN',
    resourceType: 'tournament',
    resourceId: t.tournament_id,
    afterData: { entry_id: entryId },
  });
}

export async function markEntryPaid(
  actor: Actor,
  entryId: string,
  reference: string | null,
  paid: boolean,
) {
  const entry = await loadEntry(entryId);
  const t = await loadTournament(entry.tournament_id);
  assertCanManage(t, actor);
  if (entry.payment_status === 'NOT_REQUIRED') {
    throw new TournamentError('This tournament has no entry fee.', 409);
  }
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'tournament_teams',
      paid
        ? { payment_status: 'PAID', payment_reference: reference, paid_at: new Date() }
        : { payment_status: 'UNPAID', payment_reference: null, paid_at: null },
      { entry_id: entryId },
    );
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: paid ? 'TOURNAMENT_ENTRY_PAID' : 'TOURNAMENT_ENTRY_UNPAID',
    resourceType: 'tournament',
    resourceId: t.tournament_id,
    afterData: { entry_id: entryId, reference },
  });
  return loadEntry(entryId);
}

export async function setSeeds(actor: Actor, tournamentId: string, order: string[]) {
  const t = await loadTournament(tournamentId);
  assertCanManage(t, actor);
  if (t.status !== 'DRAFT' && t.status !== 'REGISTRATION_OPEN') {
    throw new TournamentError('Seeds can’t change once the tournament has started.', 409);
  }
  const entries = await q<EntryRow>(
    "SELECT * FROM tournament_teams WHERE tournament_id = :tournamentId AND status = 'APPROVED'",
    { tournamentId },
  );
  const valid = new Set(entries.map((e) => e.entry_id));
  if (order.some((id) => !valid.has(id)) || new Set(order).size !== order.length) {
    throw new TournamentError('Seeds must list approved teams of this tournament, once each.', 400);
  }
  for (let i = 0; i < order.length; i++) {
    await sequelize
      .getQueryInterface()
      .bulkUpdate('tournament_teams', { seed: i + 1 }, { entry_id: order[i] });
  }
}

// ---- fixtures -----------------------------------------------------------------

async function loadFixtures(tournamentId: string): Promise<FixtureRow[]> {
  return q<FixtureRow>(
    'SELECT * FROM tournament_fixtures WHERE tournament_id = :tournamentId ORDER BY match_number ASC',
    { tournamentId },
  );
}

async function insertFixtures(tournamentId: string, seeds: FixtureSeed[]) {
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert(
    'tournament_fixtures',
    seeds.map((s) => ({
      fixture_id: randomUUID(),
      tournament_id: tournamentId,
      stage: s.stage,
      round_number: s.round_number,
      match_number: s.match_number,
      team_a_entry_id: s.team_a_id,
      team_b_entry_id: s.team_b_id,
      next_match_number: s.next_match_number,
      next_slot: s.next_slot,
      scheduled_at: null,
      venue_note: null,
      status: 'SCHEDULED',
      result_type: null,
      winner_entry_id: null,
      team_a_runs: null,
      team_a_wickets: null,
      team_a_balls: null,
      team_b_runs: null,
      team_b_wickets: null,
      team_b_balls: null,
      match_id: null,
      created_at: now,
      updated_at: now,
    })),
  );
}

// Puts a knockout winner into the slot of the fixture they advance to.
async function advanceWinner(
  tournamentId: string,
  fixture: FixtureRow,
  winnerEntryId: string | null,
) {
  if (!fixture.next_match_number || !fixture.next_slot) return;
  await sequelize.getQueryInterface().bulkUpdate(
    'tournament_fixtures',
    {
      [fixture.next_slot === 'A' ? 'team_a_entry_id' : 'team_b_entry_id']: winnerEntryId,
      updated_at: new Date(),
    },
    { tournament_id: tournamentId, match_number: fixture.next_match_number },
  );
}

// A first-round fixture with one team and no opponent is a bye: that team goes
// straight through.
async function resolveByes(tournamentId: string) {
  const fixtures = await loadFixtures(tournamentId);
  for (const f of fixtures) {
    if (
      f.stage === 'KNOCKOUT' &&
      f.status === 'SCHEDULED' &&
      isBye({
        stage: f.stage,
        round_number: f.round_number,
        team_a_id: f.team_a_entry_id,
        team_b_id: f.team_b_entry_id,
      })
    ) {
      const winner = f.team_a_entry_id ?? f.team_b_entry_id;
      await sequelize
        .getQueryInterface()
        .bulkUpdate(
          'tournament_fixtures',
          {
            status: 'COMPLETED',
            result_type: 'WIN',
            winner_entry_id: winner,
            updated_at: new Date(),
          },
          { fixture_id: f.fixture_id },
        );
      await advanceWinner(tournamentId, f, winner);
    }
  }
}

export async function startTournament(actor: Actor, id: string) {
  const t = await loadTournament(id);
  assertCanManage(t, actor);
  if (t.status !== 'REGISTRATION_OPEN' && t.status !== 'DRAFT') {
    throw new TournamentError('This tournament has already started or finished.', 409);
  }
  const entries = await q<EntryRow>(
    `SELECT * FROM tournament_teams WHERE tournament_id = :id AND status = 'APPROVED'
     ORDER BY (seed IS NULL), seed ASC, registered_at ASC`,
    { id },
  );
  if (entries.length < Math.max(2, t.min_teams)) {
    throw new TournamentError(
      `At least ${Math.max(2, t.min_teams)} approved teams are needed to start.`,
      409,
    );
  }
  const ids = entries.map((e) => e.entry_id);
  const seeds =
    t.format === 'KNOCKOUT'
      ? generateKnockout(ids)
      : generateRoundRobin(ids, Boolean(t.double_round));
  await insertFixtures(id, seeds);
  await resolveByes(id);
  await setStatus(id, 'IN_PROGRESS');
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_STARTED',
    resourceType: 'tournament',
    resourceId: id,
    afterData: { teams: ids.length, fixtures: seeds.length },
  });
  return loadTournament(id);
}

export async function startKnockout(actor: Actor, id: string) {
  const t = await loadTournament(id);
  assertCanManage(t, actor);
  if (t.format !== 'LEAGUE_KNOCKOUT' || t.status !== 'IN_PROGRESS') {
    throw new TournamentError('This tournament has no knockout stage to start.', 409);
  }
  const fixtures = await loadFixtures(id);
  if (fixtures.some((f) => f.stage === 'KNOCKOUT')) {
    throw new TournamentError('The knockout stage has already started.', 409);
  }
  const league = fixtures.filter((f) => f.stage === 'LEAGUE');
  if (league.some((f) => f.status !== 'COMPLETED')) {
    throw new TournamentError('Finish every league match before starting the knockout.', 409);
  }
  const { table } = await buildTable(t, fixtures);
  const take = knockoutQualifiers(table.length);
  const qualifiers = table.slice(0, take).map((r) => r.team_id);
  const next = Math.max(...fixtures.map((f) => f.match_number)) + 1;
  await insertFixtures(id, generateKnockout(qualifiers, next));
  await resolveByes(id);
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_KNOCKOUT_STARTED',
    resourceType: 'tournament',
    resourceId: id,
    afterData: { qualifiers: take },
  });
  return loadTournament(id);
}

export async function scheduleFixture(
  actor: Actor,
  fixtureId: string,
  scheduledAt: string | null,
  venueNote: string | null,
) {
  const [fixture] = await q<FixtureRow>(
    'SELECT * FROM tournament_fixtures WHERE fixture_id = :fixtureId',
    { fixtureId },
  );
  if (!fixture) throw new TournamentError('Fixture not found.', 404);
  assertCanManage(await loadTournament(fixture.tournament_id), actor);
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'tournament_fixtures',
      {
        scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
        venue_note: venueNote,
        updated_at: new Date(),
      },
      { fixture_id: fixtureId },
    );
}

export interface ResultInput {
  result_type: 'WIN' | 'TIE' | 'NO_RESULT';
  winner_entry_id?: string | null;
  team_a_runs?: number | null;
  team_a_wickets?: number | null;
  team_a_overs?: number | null;
  team_b_runs?: number | null;
  team_b_wickets?: number | null;
  team_b_overs?: number | null;
}

async function loadEditableFixture(actor: Actor, fixtureId: string) {
  const [fixture] = await q<FixtureRow>(
    'SELECT * FROM tournament_fixtures WHERE fixture_id = :fixtureId',
    { fixtureId },
  );
  if (!fixture) throw new TournamentError('Fixture not found.', 404);
  const t = await loadTournament(fixture.tournament_id);
  assertCanManage(t, actor);
  if (t.status !== 'IN_PROGRESS') {
    throw new TournamentError(
      'Results can only be changed while the tournament is in progress.',
      409,
    );
  }
  return { fixture, t };
}

export async function recordResult(actor: Actor, fixtureId: string, input: ResultInput) {
  const { fixture, t } = await loadEditableFixture(actor, fixtureId);
  if (!fixture.team_a_entry_id || !fixture.team_b_entry_id) {
    throw new TournamentError('This match is still waiting for its teams.', 409);
  }
  if (fixture.status === 'COMPLETED') {
    throw new TournamentError('A result is already recorded. Reopen the match to change it.', 409);
  }

  const knockout = fixture.stage === 'KNOCKOUT';
  let winner = input.winner_entry_id ?? null;
  if (input.result_type === 'WIN' || knockout) {
    if (!winner || (winner !== fixture.team_a_entry_id && winner !== fixture.team_b_entry_id)) {
      throw new TournamentError(
        knockout && input.result_type !== 'WIN'
          ? 'A knockout match needs a winner (e.g. decided by a super over).'
          : 'Choose which team won.',
        400,
      );
    }
  } else {
    winner = null;
  }

  const needsScores = !knockout && input.result_type !== 'NO_RESULT';
  const sides = ['a', 'b'] as const;
  const scores: Record<string, number | null> = {};
  for (const s of sides) {
    const runs = input[`team_${s}_runs`] ?? null;
    const overs = input[`team_${s}_overs`] ?? null;
    const wickets = input[`team_${s}_wickets`] ?? null;
    if (needsScores && (runs === null || overs === null)) {
      throw new TournamentError(
        'Enter runs and overs for both teams — they decide net run rate.',
        400,
      );
    }
    let balls: number | null = null;
    if (overs !== null) {
      balls = ballsFromOvers(overs);
      if (balls > t.overs_per_innings * 6) {
        throw new TournamentError(`A team can face at most ${t.overs_per_innings} overs.`, 400);
      }
      if (Math.round((overs - Math.floor(overs)) * 10) > 5) {
        throw new TournamentError(
          'Overs are written like 5.3 (5 overs, 3 balls); balls go up to .5.',
          400,
        );
      }
    }
    scores[`team_${s}_runs`] = runs;
    scores[`team_${s}_wickets`] = wickets;
    scores[`team_${s}_balls`] = balls;
  }

  await sequelize.getQueryInterface().bulkUpdate(
    'tournament_fixtures',
    {
      status: 'COMPLETED',
      result_type: input.result_type,
      winner_entry_id: winner,
      ...scores,
      updated_at: new Date(),
    },
    { fixture_id: fixtureId },
  );

  if (knockout) {
    await advanceWinner(t.tournament_id, fixture, winner);
  }
  await settleTournament(t);
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_RESULT_RECORDED',
    resourceType: 'tournament',
    resourceId: t.tournament_id,
    afterData: { fixture_id: fixtureId, result_type: input.result_type, winner },
  });
}

// Champion & completion after a result: the final decides a knockout; a pure
// league is decided by the table once every match is played.
async function settleTournament(t: TournamentRow) {
  const fixtures = await loadFixtures(t.tournament_id);
  if (t.format === 'LEAGUE') {
    if (fixtures.length > 0 && fixtures.every((f) => f.status === 'COMPLETED')) {
      const { table } = await buildTable(t, fixtures);
      await setStatus(t.tournament_id, 'COMPLETED', {
        champion_entry_id: table[0]?.team_id ?? null,
      });
    }
    return;
  }
  const knockout = fixtures.filter((f) => f.stage === 'KNOCKOUT');
  if (knockout.length === 0) return;
  const final = knockout.reduce((a, b) => (a.round_number >= b.round_number ? a : b));
  if (final.status === 'COMPLETED') {
    await setStatus(t.tournament_id, 'COMPLETED', { champion_entry_id: final.winner_entry_id });
  }
}

export async function reopenFixture(actor: Actor, fixtureId: string) {
  const { fixture, t } = await loadEditableFixture(actor, fixtureId);
  if (fixture.status !== 'COMPLETED')
    throw new TournamentError('That match has no result to reopen.', 409);
  const fixtures = await loadFixtures(t.tournament_id);

  if (fixture.stage === 'LEAGUE') {
    if (fixtures.some((f) => f.stage === 'KNOCKOUT')) {
      throw new TournamentError('The knockout has started, so league results are locked.', 409);
    }
  } else if (fixture.next_match_number) {
    const next = fixtures.find((f) => f.match_number === fixture.next_match_number);
    if (next?.status === 'COMPLETED') {
      throw new TournamentError('The next round has already been played.', 409);
    }
    await advanceWinner(t.tournament_id, fixture, null);
  }

  await sequelize.getQueryInterface().bulkUpdate(
    'tournament_fixtures',
    {
      status: 'SCHEDULED',
      result_type: null,
      winner_entry_id: null,
      team_a_runs: null,
      team_a_wickets: null,
      team_a_balls: null,
      team_b_runs: null,
      team_b_wickets: null,
      team_b_balls: null,
      updated_at: new Date(),
    },
    { fixture_id: fixtureId },
  );
  await writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'TOURNAMENT_RESULT_REOPENED',
    resourceType: 'tournament',
    resourceId: t.tournament_id,
    afterData: { fixture_id: fixtureId },
  });
}

// ---- reading --------------------------------------------------------------------

async function loadEntriesWithTeams(tournamentId: string) {
  return q<
    EntryRow & {
      team_name: string;
      team_logo_url: string | null;
      registered_by_phone: string | null;
    }
  >(
    `SELECT e.*, tm.team_name, tm.team_logo_url, u.phone_number AS registered_by_phone
     FROM tournament_teams e
     JOIN teams tm ON tm.team_id = e.team_id
     LEFT JOIN users u ON u.user_id = e.registered_by
     WHERE e.tournament_id = :tournamentId
     ORDER BY e.registered_at ASC`,
    { tournamentId },
  );
}

async function buildTable(t: TournamentRow, fixtures: FixtureRow[]) {
  const entries = (await loadEntriesWithTeams(t.tournament_id)).filter(
    (e) => e.status === 'APPROVED',
  );
  const table = computePointsTable(
    entries.map((e) => ({ team_id: e.entry_id, name: e.team_name })),
    fixtures
      .filter((f) => f.stage === 'LEAGUE')
      .map((f) => ({
        team_a_id: f.team_a_entry_id,
        team_b_id: f.team_b_entry_id,
        status: f.status,
        result_type: f.result_type,
        winner_team_id: f.winner_entry_id,
        team_a_runs: f.team_a_runs,
        team_a_balls: f.team_a_balls,
        team_b_runs: f.team_b_runs,
        team_b_balls: f.team_b_balls,
      })),
  );
  return { table, entries };
}

export async function listTournaments(actor: Actor, filter: { status?: string } = {}) {
  const where = ['t.deleted_at IS NULL'];
  const replacements: Record<string, unknown> = { userId: actor.userId };
  if (filter.status) {
    where.push('t.status = :status');
    replacements.status = filter.status;
  }
  if (actor.role === 'TURF_OWNER') {
    where.push(
      "(t.status <> 'DRAFT' OR t.organiser_id = :userId OR t.turf_id IN (SELECT turf_id FROM turfs WHERE owner_id = :userId))",
    );
  } else if (actor.role !== 'ADMIN') {
    where.push("t.status <> 'DRAFT'");
  }
  return q<TournamentRow & { turf_name: string | null; teams: number | string }>(
    `SELECT t.*, tr.turf_name,
            (SELECT COUNT(*) FROM tournament_teams e
             WHERE e.tournament_id = t.tournament_id AND e.status = 'APPROVED') AS teams
     FROM tournaments t LEFT JOIN turfs tr ON tr.turf_id = t.turf_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.created_at DESC LIMIT 200`,
    replacements,
  );
}

export async function getTournament(actor: Actor, id: string) {
  const t = await loadTournament(id);
  if (!(await canView(t, actor))) throw new TournamentError('Tournament not found.', 404);

  const [fixtures, entries, [turf]] = await Promise.all([
    loadFixtures(id),
    loadEntriesWithTeams(id),
    q<{ turf_name: string }>('SELECT turf_name FROM turfs WHERE turf_id = :turfId', {
      turfId: t.turf_id,
    }),
  ]);
  const { table } = await buildTable(t, fixtures);
  const nameOf = new Map(entries.map((e) => [e.entry_id, e.team_name]));
  const knockoutRounds = Math.max(
    0,
    ...fixtures.filter((f) => f.stage === 'KNOCKOUT').map((f) => f.round_number),
  );
  const leagueRounds = Math.max(
    0,
    ...fixtures.filter((f) => f.stage === 'LEAGUE').map((f) => f.round_number),
  );

  const isManager = isAdmin(actor) || t.organiser_id === actor.userId;
  const allLeagueDone =
    fixtures.some((f) => f.stage === 'LEAGUE') &&
    fixtures.filter((f) => f.stage === 'LEAGUE').every((f) => f.status === 'COMPLETED');

  return {
    tournament: {
      ...t,
      entry_fee: Number(t.entry_fee),
      double_round: Boolean(t.double_round),
      turf_name: turf?.turf_name ?? null,
      champion_name: t.champion_entry_id ? (nameOf.get(t.champion_entry_id) ?? null) : null,
    },
    can_manage: isManager,
    can_start_knockout:
      isManager &&
      t.format === 'LEAGUE_KNOCKOUT' &&
      t.status === 'IN_PROGRESS' &&
      allLeagueDone &&
      !fixtures.some((f) => f.stage === 'KNOCKOUT'),
    entries: entries.map((e) => ({
      ...e,
      // contact details only for the people running it
      registered_by_phone: isManager ? e.registered_by_phone : null,
    })),
    fixtures: fixtures.map((f) => ({
      ...f,
      stage_label:
        f.stage === 'KNOCKOUT'
          ? roundName(f.round_number, knockoutRounds)
          : `Round ${f.round_number}${leagueRounds ? ` of ${leagueRounds}` : ''}`,
      team_a_name: f.team_a_entry_id ? (nameOf.get(f.team_a_entry_id) ?? null) : null,
      team_b_name: f.team_b_entry_id ? (nameOf.get(f.team_b_entry_id) ?? null) : null,
      winner_name: f.winner_entry_id ? (nameOf.get(f.winner_entry_id) ?? null) : null,
      team_a_overs: f.team_a_balls != null ? oversFromBalls(f.team_a_balls) : null,
      team_b_overs: f.team_b_balls != null ? oversFromBalls(f.team_b_balls) : null,
    })),
    table: table.map((r) => ({
      ...r,
      overs_for: oversFromBalls(r.balls_for),
      overs_against: oversFromBalls(r.balls_against),
    })),
  };
}
