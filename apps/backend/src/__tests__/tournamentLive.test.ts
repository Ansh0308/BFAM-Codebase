// Tournament follow-ups: paying the entry fee online, linking fixtures to the
// live-scoring engine (host only), and carrying a finished match's result back
// into the fixture.

const ADMIN = 'aaaaaaaa-0000-4000-8000-009001';
const HOST = 'aaaaaaaa-0000-4000-8000-009002';
const CAPTAIN = 'aaaaaaaa-0000-4000-8000-009003';
const STRANGER = 'aaaaaaaa-0000-4000-8000-009004';
const PLAYER_USER = 'aaaaaaaa-0000-4000-8000-009005';
const TOURNEY = 'cccccccc-0000-4000-8000-000000009001';
const TURF = 'bbbbbbbb-0000-4000-8000-000000009001';
const TEAM_A = 'dddddddd-0000-4000-8000-00000000a001';
const TEAM_B = 'dddddddd-0000-4000-8000-00000000a002';
const ENTRY_A = 'eeeeeeee-0000-4000-8000-00000000a001';
const ENTRY_B = 'eeeeeeee-0000-4000-8000-00000000a002';
const ENTRY_C = 'eeeeeeee-0000-4000-8000-00000000a003';
const FIX = 'ffffffff-0000-4000-8000-000000009001';
const MATCH = '11111111-0000-4000-8000-000000009001';
const SIDE_A = '22222222-0000-4000-8000-00000000a001';
const SIDE_B = '22222222-0000-4000-8000-00000000a002';

type Row = Record<string, unknown>;
const inserts: Array<{ table: string; rows: Row[] }> = [];
const updates: Array<{ table: string; values: Row; where: Row }> = [];
let tournament: Row;
let entries: Row[] = [];
let fixtures: Row[] = [];
let matchStatus: string | null = null;
let slotTakenByOther = false;
let ownBooking = false;
let matchResult: Row | null = null;
let inningsRows: Row[] = [];
let sidePlayers = { a: 6, b: 6 };

const base = (over: Row = {}): Row => ({
  tournament_id: TOURNEY,
  name: 'Diwali Cup',
  description: null,
  format: 'LEAGUE',
  organiser_id: HOST,
  turf_id: TURF,
  overs_per_innings: 6,
  entry_fee: '500.00',
  min_teams: 2,
  max_teams: 8,
  double_round: 0,
  start_date: null,
  registration_deadline: null,
  status: 'REGISTRATION_OPEN',
  champion_entry_id: null,
  created_at: new Date(),
  ...over,
});
const entry = (id: string, team: string, over: Row = {}): Row => ({
  entry_id: id,
  tournament_id: TOURNEY,
  team_id: team,
  registered_by: CAPTAIN,
  status: 'APPROVED',
  payment_status: 'UNPAID',
  payment_reference: null,
  paid_at: null,
  payment_id: null,
  seed: null,
  registered_at: new Date(),
  team_name: team === TEAM_A ? 'Alpha' : 'Bravo',
  team_logo_url: null,
  registered_by_phone: '+91',
  ...over,
});
const fixture = (over: Row = {}): Row => ({
  fixture_id: FIX,
  tournament_id: TOURNEY,
  stage: 'LEAGUE',
  round_number: 1,
  match_number: 1,
  team_a_entry_id: ENTRY_A,
  team_b_entry_id: ENTRY_B,
  next_match_number: null,
  next_slot: null,
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
  ...over,
});

jest.mock('../config/sequelize', () => ({
  sequelize: {
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
    getQueryInterface: () => ({
      bulkInsert: async (table: string, rows: Row[]) => {
        inserts.push({ table, rows });
      },
      bulkUpdate: async (table: string, values: Row, where: Row) => {
        updates.push({ table, values, where });
      },
    }),
    query: async (sql: string, options: { replacements?: Row } = {}) => {
      const r = options.replacements ?? {};
      if (sql.includes('FROM tournaments WHERE tournament_id = :id'))
        return r.id === TOURNEY ? [tournament] : [];
      if (sql.includes('SELECT organiser_id FROM tournaments'))
        return [{ organiser_id: tournament.organiser_id }];
      if (sql.includes('FROM tournament_teams WHERE entry_id = :entryId')) {
        return entries.filter((e) => e.entry_id === r.entryId);
      }
      if (sql.includes("tm.role_in_team = 'CAPTAIN'"))
        return r.userId === CAPTAIN ? [{ team_id: r.teamId }] : [];
      if (sql.includes('FROM tournament_fixtures WHERE fixture_id'))
        return fixtures.filter((f) => f.fixture_id === r.fixtureId);
      if (sql.includes('FROM tournament_fixtures WHERE match_id'))
        return fixtures.filter((f) => f.match_id === r.matchId);
      if (sql.includes('FROM tournament_fixtures WHERE tournament_id')) return fixtures;
      if (sql.includes('SELECT match_id, match_status FROM matches WHERE match_id = :matchId')) {
        return matchStatus ? [{ match_id: r.matchId, match_status: matchStatus }] : [];
      }
      if (sql.includes("turf_status = 'ACTIVE'") && sql.includes('FROM turfs'))
        return r.turfId === TURF ? [{ turf_id: TURF }] : [];
      if (sql.includes('e.entry_id IN (:ids)')) {
        return entries
          .filter((e) => (r.ids as string[]).includes(e.entry_id as string))
          .map((e) => ({ entry_id: e.entry_id, team_id: e.team_id, team_name: e.team_name }));
      }
      if (sql.includes('FROM tournament_teams e') && sql.includes('JOIN teams tm')) return entries;
      if (sql.includes('SELECT player_id FROM players WHERE user_id'))
        return [{ player_id: 'host-player' }];
      if (sql.includes("booked_by = :userId AND booking_status = 'CONFIRMED'"))
        return ownBooking ? [{ booking_id: 'own-booking' }] : [];
      if (sql.includes("booking_status IN ('PENDING', 'CONFIRMED')"))
        return slotTakenByOther ? [{ booking_id: 'other' }] : [];
      if (sql.includes('FROM team_members') && sql.includes('team_id IN (:teamIds)')) {
        return [
          { player_id: 'p1', team_id: TEAM_A, role_in_team: 'CAPTAIN' },
          { player_id: 'p2', team_id: TEAM_A, role_in_team: 'MEMBER' },
          { player_id: 'p3', team_id: TEAM_B, role_in_team: 'CAPTAIN' },
          { player_id: 'p1', team_id: TEAM_B, role_in_team: 'MEMBER' }, // plays for both: counted once
        ];
      }
      if (sql.includes('FROM match_results WHERE match_id'))
        return matchResult ? [matchResult] : [];
      if (sql.includes('FROM match_teams mt')) {
        return [
          { match_team_id: SIDE_A, team_id: TEAM_A, entry_id: ENTRY_A, players: sidePlayers.a },
          { match_team_id: SIDE_B, team_id: TEAM_B, entry_id: ENTRY_B, players: sidePlayers.b },
        ];
      }
      if (sql.includes('FROM innings WHERE match_id')) return inningsRows;
      if (sql.includes('FROM matches m') || sql.includes('FROM matches WHERE')) return [];
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));
jest.mock('../services/razorpayService', () => {
  const actual = jest.requireActual('../services/razorpayService');
  return { ...actual, createRazorpayOrder: jest.fn() };
});
jest.spyOn(console, 'error').mockImplementation(() => undefined);

import request from 'supertest';
import app from '../app';
import { createRazorpayOrder } from '../services/razorpayService';
import { GatewayNotConfiguredError, ForbiddenActionError } from '../domain/errors';
import { markEntryPaidByGateway, syncFixtureFromMatch } from '../services/tournamentService';
import { assertTournamentHost } from '../services/turfOperatorAccess';

const mockOrder = createRazorpayOrder as jest.Mock;

async function auth(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return `Bearer ${res.body.token as string}`;
}

beforeEach(() => {
  inserts.length = 0;
  updates.length = 0;
  tournament = base();
  entries = [entry(ENTRY_A, TEAM_A), entry(ENTRY_B, TEAM_B)];
  fixtures = [fixture()];
  matchStatus = null;
  slotTakenByOther = false;
  ownBooking = false;
  matchResult = null;
  inningsRows = [];
  sidePlayers = { a: 6, b: 6 };
  mockOrder.mockReset();
  mockOrder.mockResolvedValue({
    order_id: 'order_123',
    amount: 500,
    currency: 'INR',
    key_id: 'rzp_test',
  });
});

describe('paying the entry fee online', () => {
  const pay = async (user = CAPTAIN, role = 'PLAYER', body: Row = { payment_method: 'UPI' }) =>
    request(app)
      .post(`/tournaments/entries/${ENTRY_A}/pay`)
      .set('Authorization', await auth(user, role))
      .send(body);

  it('creates a Razorpay order for the entry fee, like a turf booking', async () => {
    const res = await pay();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      order_id: 'order_123',
      amount: 500,
      key_id: 'rzp_test',
      entry_id: ENTRY_A,
    });
    expect(mockOrder).toHaveBeenCalledWith(
      500,
      expect.any(String),
      expect.objectContaining({
        tournament_entry_id: ENTRY_A,
        obligation_ids: '[]',
      }),
    );
    expect(inserts.find((i) => i.table === 'payments')?.rows[0]).toMatchObject({
      payer_id: CAPTAIN,
      amount: 500,
      payment_method: 'UPI',
      gateway: 'RAZORPAY',
      payment_status: 'PENDING',
    });
    expect(updates.find((u) => u.table === 'tournament_teams')?.values).toHaveProperty(
      'payment_id',
    );
  });

  it('works for the payment-gateway option too, and rejects anything else', async () => {
    expect((await pay(CAPTAIN, 'PLAYER', { payment_method: 'RAZORPAY' })).status).toBe(201);
    expect((await pay(CAPTAIN, 'PLAYER', { payment_method: 'CASH' })).status).toBe(400);
  });

  it('only the team’s captain can pay', async () => {
    const res = await pay(STRANGER);
    expect(res.status).toBe(403);
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it('refuses when already paid, free, closed or withdrawn', async () => {
    entries = [entry(ENTRY_A, TEAM_A, { payment_status: 'PAID' })];
    expect((await pay()).status).toBe(409);
    entries = [entry(ENTRY_A, TEAM_A, { payment_status: 'NOT_REQUIRED' })];
    expect((await pay()).status).toBe(409);
    entries = [entry(ENTRY_A, TEAM_A, { status: 'WITHDRAWN' })];
    expect((await pay()).status).toBe(409);
    entries = [entry(ENTRY_A, TEAM_A)];
    tournament = base({ status: 'IN_PROGRESS' });
    expect((await pay()).status).toBe(409);
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it('says so when the gateway is not configured', async () => {
    mockOrder.mockRejectedValue(new GatewayNotConfiguredError());
    const res = await pay();
    expect(res.status).toBe(503);
    expect(inserts.find((i) => i.table === 'payments')).toBeUndefined();
  });

  it('the webhook marks the entry paid, once', async () => {
    await markEntryPaidByGateway(ENTRY_A, 'pay-1', 'rzp_pay_9');
    expect(updates.find((u) => u.table === 'tournament_teams')?.values).toMatchObject({
      payment_status: 'PAID',
      payment_id: 'pay-1',
      payment_reference: 'rzp_pay_9',
    });
    updates.length = 0;
    entries = [entry(ENTRY_A, TEAM_A, { payment_status: 'PAID' })];
    await markEntryPaidByGateway(ENTRY_A, 'pay-1', 'rzp_pay_9');
    expect(updates).toHaveLength(0); // a retried webhook is a no-op
  });

  it('a team that paid online cannot be removed until the host reverses it', async () => {
    entries = [entry(ENTRY_A, TEAM_A, { payment_status: 'PAID', payment_id: 'pay-1' })];
    const host = await auth(HOST, 'TURF_OWNER');
    const blocked = await request(app)
      .delete(`/tournaments/entries/${ENTRY_A}`)
      .set('Authorization', host);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/refund/i);

    const unpaid = await request(app)
      .post(`/tournaments/entries/${ENTRY_A}/payment`)
      .set('Authorization', host)
      .send({ paid: false });
    expect(unpaid.status).toBe(200);
    expect(updates.find((u) => u.table === 'tournament_teams')?.values).toMatchObject({
      payment_status: 'UNPAID',
      payment_id: null,
    });
  });
});

describe('setting a fixture up as a live match', () => {
  beforeEach(() => {
    tournament = base({ status: 'IN_PROGRESS' });
  });

  const create = async (user = HOST, role = 'TURF_OWNER', body: Row = {}) =>
    request(app)
      .post(`/tournaments/fixtures/${FIX}/match`)
      .set('Authorization', await auth(user, role))
      .send({ scheduled_at: '2026-11-02T10:30:00.000Z', ...body });

  it('builds the booking, the match, both sides and the squads', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ booking_date: '2026-11-02', start_time: '16:00:00' }); // 10:30Z = 16:00 IST

    expect(inserts.find((i) => i.table === 'bookings')?.rows[0]).toMatchObject({
      booked_by: HOST,
      booking_amount: 0,
      booking_status: 'CONFIRMED',
      turf_id: TURF,
    });
    expect(inserts.find((i) => i.table === 'matches')?.rows[0]).toMatchObject({
      tournament_id: TOURNEY,
      organizer_id: HOST,
      assigned_scorer_id: HOST,
      match_type: 'TOURNAMENT',
      scoring_mode: 'TURF_STAFF_MANAGED',
      overs_per_innings: 6,
    });
    const sides = inserts.find((i) => i.table === 'match_teams')!.rows;
    expect(sides.map((s) => [s.side_label, s.team_id])).toEqual([
      ['TEAM_A', TEAM_A],
      ['TEAM_B', TEAM_B],
    ]);

    // squads land on their own side, a player in both squads once
    const roster = inserts.find((i) => i.table === 'match_players')!.rows;
    expect(roster).toHaveLength(3);
    expect(roster.every((p) => p.invitation_status === 'CONFIRMED' && p.match_team_id)).toBe(true);
    expect(roster.find((p) => p.player_id === 'p1')?.participant_role).toBe('CAPTAIN');

    // the fixture now points at the match
    expect(updates.find((u) => u.table === 'tournament_fixtures')?.values).toMatchObject({
      match_id: expect.any(String),
    });
  });

  it('only the host can do it — not another owner, not even an admin', async () => {
    expect((await create(STRANGER, 'TURF_OWNER')).status).toBe(403);
    expect((await create(ADMIN, 'ADMIN')).status).toBe(403);
    expect(inserts.find((i) => i.table === 'matches')).toBeUndefined();
  });

  it('needs the tournament to be running and the fixture to be ready', async () => {
    tournament = base({ status: 'REGISTRATION_OPEN' });
    expect((await create()).status).toBe(409);
    tournament = base({ status: 'IN_PROGRESS' });
    fixtures = [fixture({ team_b_entry_id: null })];
    expect((await create()).status).toBe(409);
    fixtures = [fixture({ match_id: MATCH })];
    expect((await create()).status).toBe(409);
    fixtures = [fixture({ status: 'COMPLETED' })];
    expect((await create()).status).toBe(409);
  });

  it('an admin-hosted tournament has no turf, so one has to be chosen', async () => {
    tournament = base({ status: 'IN_PROGRESS', organiser_id: ADMIN, turf_id: null });
    const none = await create(ADMIN, 'ADMIN');
    expect(none.status).toBe(400);
    const ok = await create(ADMIN, 'ADMIN', { turf_id: TURF });
    expect(ok.status).toBe(201);
  });

  it('refuses a slot someone else has booked, but shares the host’s own', async () => {
    slotTakenByOther = true;
    const taken = await create();
    expect(taken.status).toBe(409);
    expect(taken.body.error.message).toMatch(/already booked/i);
    expect(inserts.find((i) => i.table === 'matches')).toBeUndefined();

    slotTakenByOther = false;
    ownBooking = true;
    inserts.length = 0;
    const shared = await create();
    expect(shared.status).toBe(201);
    expect(inserts.find((i) => i.table === 'bookings')).toBeUndefined();
    expect(inserts.find((i) => i.table === 'matches')?.rows[0]).toMatchObject({
      booking_id: 'own-booking',
    });
  });
});

describe('host-only scoring', () => {
  it('lets the host through and stops everyone else', async () => {
    tournament = base();
    await expect(assertTournamentHost(TOURNEY, HOST)).resolves.toBeUndefined();
    await expect(assertTournamentHost(TOURNEY, STRANGER)).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
    await expect(assertTournamentHost(TOURNEY, ADMIN)).rejects.toThrow(/tournament host/);
  });
});

describe('manual results for a live fixture', () => {
  beforeEach(() => {
    tournament = base({ status: 'IN_PROGRESS' });
  });
  const manual = async () =>
    request(app)
      .post(`/tournaments/fixtures/${FIX}/result`)
      .set('Authorization', await auth(HOST, 'TURF_OWNER'))
      .send({ result_type: 'NO_RESULT' });

  it('is blocked while the match is still being played', async () => {
    fixtures = [fixture({ match_id: MATCH })];
    for (const status of ['OPEN', 'CONFIRMED', 'IN_PROGRESS']) {
      matchStatus = status;
      const res = await manual();
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/scored live/);
    }
  });

  it('is allowed once the match is finished or cancelled', async () => {
    fixtures = [fixture({ match_id: MATCH })];
    matchStatus = 'CANCELLED';
    expect((await manual()).status).toBe(204);
  });
});

describe('carrying a finished match into the fixture', () => {
  const finished = (winnerSide: string | null, type = 'WIN') => {
    matchResult = { winning_match_team_id: winnerSide, result_type: type };
  };
  const committed = () =>
    updates.filter((u) => u.table === 'tournament_fixtures').map((u) => u.values);

  beforeEach(() => {
    tournament = base({ status: 'IN_PROGRESS' });
    fixtures = [fixture({ match_id: MATCH })];
    inningsRows = [
      { batting_match_team_id: SIDE_A, total_runs: 61, total_wickets: 2, overs_completed: '6' },
      { batting_match_team_id: SIDE_B, total_runs: 48, total_wickets: 3, overs_completed: '5.3' },
    ];
  });

  it('copies the winner, runs, wickets and balls', async () => {
    finished(SIDE_A);
    await syncFixtureFromMatch(MATCH);
    expect(committed()[0]).toMatchObject({
      status: 'COMPLETED',
      result_type: 'WIN',
      winner_entry_id: ENTRY_A,
      team_a_runs: 61,
      team_a_wickets: 2,
      team_a_balls: 36,
      team_b_runs: 48,
      team_b_wickets: 3,
      team_b_balls: 33,
    });
  });

  it('charges a side that was all out its full overs', async () => {
    finished(SIDE_A);
    inningsRows[1] = {
      batting_match_team_id: SIDE_B,
      total_runs: 40,
      total_wickets: 5,
      overs_completed: '4.2',
    };
    sidePlayers = { a: 6, b: 6 }; // 5 wickets = all out for a 6-player side
    await syncFixtureFromMatch(MATCH);
    expect(committed()[0]).toMatchObject({ team_b_wickets: 5, team_b_balls: 36 });
  });

  it('records a tie and a no result without a winner', async () => {
    finished(null, 'TIE');
    await syncFixtureFromMatch(MATCH);
    expect(committed()[0]).toMatchObject({ result_type: 'TIE', winner_entry_id: null });
  });

  it('does nothing for a fixture already settled, or a match with no result yet', async () => {
    matchResult = null;
    await syncFixtureFromMatch(MATCH);
    fixtures = [fixture({ match_id: MATCH, status: 'COMPLETED' })];
    finished(SIDE_A);
    await syncFixtureFromMatch(MATCH);
    expect(committed()).toHaveLength(0);
  });

  it('puts a knockout winner into the next round, but leaves a knockout tie to the host', async () => {
    fixtures = [
      fixture({ match_id: MATCH, stage: 'KNOCKOUT', next_match_number: 3, next_slot: 'A' }),
      fixture({
        fixture_id: 'x',
        match_number: 3,
        round_number: 2,
        team_a_entry_id: null,
        team_b_entry_id: null,
      }),
    ];
    finished(SIDE_B);
    await syncFixtureFromMatch(MATCH);
    expect(committed().some((v) => v.team_a_entry_id === ENTRY_B)).toBe(true);

    updates.length = 0;
    finished(null, 'TIE');
    await syncFixtureFromMatch(MATCH);
    expect(committed()).toHaveLength(0);
  });
});

describe('settling a knockout tie (host picks who goes through)', () => {
  const settle = async (body: Row, user = HOST, role = 'TURF_OWNER') =>
    request(app)
      .post(`/tournaments/fixtures/${FIX}/settle`)
      .set('Authorization', await auth(user, role))
      .send(body);
  const committed = () =>
    updates.filter((u) => u.table === 'tournament_fixtures').map((u) => u.values);

  beforeEach(() => {
    tournament = base({ status: 'IN_PROGRESS', format: 'KNOCKOUT' });
    fixtures = [
      fixture({ match_id: MATCH, stage: 'KNOCKOUT', next_match_number: 3, next_slot: 'A' }),
      fixture({
        fixture_id: 'x',
        match_number: 3,
        round_number: 2,
        team_a_entry_id: null,
        team_b_entry_id: null,
      }),
    ];
    matchStatus = 'COMPLETED';
    matchResult = { winning_match_team_id: null, result_type: 'TIE' };
    inningsRows = [
      { batting_match_team_id: SIDE_A, total_runs: 50, total_wickets: 2, overs_completed: '6' },
      { batting_match_team_id: SIDE_B, total_runs: 50, total_wickets: 3, overs_completed: '6' },
    ];
  });

  it('keeps the match scores and advances the chosen team', async () => {
    const res = await settle({ winner_entry_id: ENTRY_B });
    expect(res.status).toBe(204);
    expect(committed()[0]).toMatchObject({
      status: 'COMPLETED',
      result_type: 'TIE',
      winner_entry_id: ENTRY_B,
      team_a_runs: 50,
      team_b_runs: 50,
      team_a_balls: 36,
    });
    // the winner goes into the next round's slot
    expect(committed().some((v) => v.team_a_entry_id === ENTRY_B)).toBe(true);
  });

  it('can only be one of the two teams in the match', async () => {
    expect((await settle({ winner_entry_id: ENTRY_C })).status).toBe(400);
    expect(committed()).toHaveLength(0);
  });

  it('needs the live match to be finished first', async () => {
    matchStatus = 'IN_PROGRESS';
    expect((await settle({ winner_entry_id: ENTRY_A })).status).toBe(409);
  });

  it('is only for a knockout match that has not been settled', async () => {
    fixtures = [fixture({ match_id: MATCH, stage: 'LEAGUE' })];
    expect((await settle({ winner_entry_id: ENTRY_A })).status).toBe(409);
    fixtures = [fixture({ match_id: MATCH, stage: 'KNOCKOUT', status: 'COMPLETED' })];
    expect((await settle({ winner_entry_id: ENTRY_A })).status).toBe(409);
  });

  it('is limited to the organiser or an admin', async () => {
    expect((await settle({ winner_entry_id: ENTRY_A }, STRANGER, 'TURF_OWNER')).status).toBe(403);
    expect((await settle({ winner_entry_id: ENTRY_A }, PLAYER_USER, 'PLAYER')).status).toBe(403);
    expect((await settle({})).status).toBe(400);
  });
});
