// Tournament routes: who may do what, validation, and the state rules.
// (The fixture / table maths is covered in tournamentEngine.test.ts.)

const ADMIN = 'aaaaaaaa-0000-4000-8000-007001';
const OWNER = 'aaaaaaaa-0000-4000-8000-007002';
const OTHER_OWNER = 'aaaaaaaa-0000-4000-8000-007003';
const CAPTAIN = 'aaaaaaaa-0000-4000-8000-007004';
const PLAYER = 'aaaaaaaa-0000-4000-8000-007005';
const TURF = 'bbbbbbbb-0000-4000-8000-000000007001';
const TOURNEY = 'cccccccc-0000-4000-8000-000000007001';
const TEAM = 'dddddddd-0000-4000-8000-000000007001';
const ENTRY_A = 'eeeeeeee-0000-4000-8000-00000000a001';
const ENTRY_B = 'eeeeeeee-0000-4000-8000-00000000a002';
const ENTRY_C = 'eeeeeeee-0000-4000-8000-00000000a003';
const FIX = 'ffffffff-0000-4000-8000-000000007001';
const GHOST_TEAM = 'dddddddd-0000-4000-8000-000000009999';

interface Row {
  [key: string]: unknown;
}
let tournament: Row;
let entries: Row[] = [];
let fixtures: Row[] = [];
let approved = 0;
const inserts: Array<{ table: string; rows: Row[] }> = [];
const updates: Array<{ table: string; values: Row; where: Row }> = [];
const sqls: string[] = [];

const baseTournament = (over: Row = {}): Row => ({
  tournament_id: TOURNEY,
  name: 'Diwali Cup',
  description: null,
  format: 'LEAGUE',
  organiser_id: OWNER,
  turf_id: TURF,
  overs_per_innings: 6,
  entry_fee: '500.00',
  min_teams: 3,
  max_teams: 8,
  double_round: 0,
  start_date: null,
  registration_deadline: null,
  status: 'REGISTRATION_OPEN',
  champion_entry_id: null,
  created_at: new Date(),
  ...over,
});
const entry = (id: string, over: Row = {}): Row => ({
  entry_id: id,
  tournament_id: TOURNEY,
  team_id: `team-${id}`,
  registered_by: OWNER,
  status: 'APPROVED',
  payment_status: 'UNPAID',
  payment_reference: null,
  paid_at: null,
  seed: null,
  registered_at: new Date(),
  team_name: `Team ${id.slice(-1)}`,
  team_logo_url: null,
  registered_by_phone: '+911',
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
      sqls.push(sql);
      if (sql.includes('FROM tournaments WHERE tournament_id = :id')) {
        if (r.id === TOURNEY) return [tournament];
        const made = inserts.find(
          (i) => i.table === 'tournaments' && i.rows[0].tournament_id === r.id,
        );
        return made ? [made.rows[0]] : [];
      }
      if (sql.includes('FROM turfs WHERE turf_id = :turfId AND owner_id = :userId')) {
        return r.turfId === TURF && r.userId === OWNER ? [{ turf_id: TURF }] : [];
      }
      if (sql.includes('FROM turfs WHERE turf_id = :id'))
        return r.id === TURF ? [{ turf_id: TURF }] : [];
      if (sql.includes('SELECT turf_name FROM turfs')) return [{ turf_name: 'Green Park' }];
      if (sql.includes("FROM teams WHERE team_id = :teamId AND team_status = 'ACTIVE'")) {
        return r.teamId === GHOST_TEAM ? [] : [{ team_id: r.teamId }];
      }
      if (sql.includes('FROM tournament_teams WHERE tournament_id = :tid AND team_id = :teamId'))
        return [];
      if (sql.includes("tm.role_in_team = 'CAPTAIN'"))
        return r.userId === CAPTAIN ? [{ team_id: TEAM }] : [];
      if (sql.includes('FROM tournament_teams WHERE entry_id = :entryId')) {
        const e =
          entries.find((x) => x.entry_id === r.entryId) ??
          inserts.find((i) => i.table === 'tournament_teams' && i.rows[0].entry_id === r.entryId)
            ?.rows[0];
        return e ? [e] : [];
      }
      if (sql.includes("status = 'APPROVED'") && sql.includes('COUNT(*)')) return [{ n: approved }];
      if (sql.includes('ORDER BY (seed IS NULL)'))
        return entries.filter((e) => e.status === 'APPROVED');
      if (sql.includes('FROM tournament_fixtures WHERE fixture_id')) {
        return fixtures.filter((f) => f.fixture_id === r.fixtureId);
      }
      if (sql.includes('FROM tournament_fixtures WHERE tournament_id')) return fixtures;
      if (sql.includes('FROM tournament_teams e') && sql.includes('JOIN teams tm')) return entries;
      if (sql.includes('FROM tournaments t LEFT JOIN turfs tr')) return [tournament];
      throw new Error(`Unexpected query in test fake: ${sql}`);
    },
  },
}));

import request from 'supertest';
import app from '../app';

async function auth(userId: string, role: string) {
  const res = await request(app).post('/auth/dev-token').send({ role, user_id: userId });
  return `Bearer ${res.body.token as string}`;
}

const VALID = {
  name: 'Diwali Cup',
  format: 'LEAGUE',
  overs_per_innings: 6,
  entry_fee: 500,
  min_teams: 3,
  max_teams: 8,
};

beforeEach(() => {
  tournament = baseTournament();
  entries = [];
  fixtures = [];
  approved = 0;
  inserts.length = 0;
  updates.length = 0;
  sqls.length = 0;
});

describe('creating a tournament', () => {
  it('lets a player browse but not create', async () => {
    const res = await request(app)
      .post('/tournaments')
      .set('Authorization', await auth(PLAYER, 'PLAYER'))
      .send(VALID);
    expect(res.status).toBe(403);
  });

  it('hides drafts from players when listing', async () => {
    const res = await request(app)
      .get('/tournaments')
      .set('Authorization', await auth(PLAYER, 'PLAYER'));
    expect(res.status).toBe(200);
    expect(sqls.some((s) => s.includes("t.status <> 'DRAFT'"))).toBe(true);
  });

  it('makes an owner pick one of their own turfs', async () => {
    const none = await request(app)
      .post('/tournaments')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send(VALID);
    expect(none.status).toBe(400);

    const foreign = await request(app)
      .post('/tournaments')
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'))
      .send({ ...VALID, turf_id: TURF });
    expect(foreign.status).toBe(403);

    const ok = await request(app)
      .post('/tournaments')
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ ...VALID, turf_id: TURF });
    expect(ok.status).toBe(201);
    expect(inserts.find((i) => i.table === 'tournaments')?.rows[0]).toMatchObject({
      organiser_id: OWNER,
      turf_id: TURF,
      status: 'DRAFT',
    });
  });

  it('lets an admin create a platform-wide tournament with no turf', async () => {
    const res = await request(app)
      .post('/tournaments')
      .set('Authorization', await auth(ADMIN, 'ADMIN'))
      .send(VALID);
    expect(res.status).toBe(201);
    expect(inserts.find((i) => i.table === 'tournaments')?.rows[0]).toMatchObject({
      turf_id: null,
    });
  });

  it('rejects bad details and min above max', async () => {
    const admin = await auth(ADMIN, 'ADMIN');
    expect(
      (
        await request(app)
          .post('/tournaments')
          .set('Authorization', admin)
          .send({ ...VALID, name: 'x' })
      ).status,
    ).toBe(400);
    const res = await request(app)
      .post('/tournaments')
      .set('Authorization', admin)
      .send({ ...VALID, min_teams: 10, max_teams: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/minimum/i);
  });
});

describe('who can change a tournament', () => {
  it('stops another owner editing it', async () => {
    const res = await request(app)
      .patch(`/tournaments/${TOURNEY}`)
      .set('Authorization', await auth(OTHER_OWNER, 'TURF_OWNER'))
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it('lets the organiser and any admin edit', async () => {
    for (const [id, role] of [
      [OWNER, 'TURF_OWNER'],
      [ADMIN, 'ADMIN'],
    ]) {
      const res = await request(app)
        .patch(`/tournaments/${TOURNEY}`)
        .set('Authorization', await auth(id, role))
        .send({ name: 'Renamed Cup' });
      expect(res.status).toBe(200);
    }
  });

  it('locks editing once it has started', async () => {
    tournament = baseTournament({ status: 'IN_PROGRESS' });
    const res = await request(app)
      .patch(`/tournaments/${TOURNEY}`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ name: 'Late change' });
    expect(res.status).toBe(409);
  });

  it('404s an unknown tournament and hides someone else’s draft', async () => {
    const missing = await request(app)
      .get('/tournaments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', await auth(ADMIN, 'ADMIN'));
    expect(missing.status).toBe(404);

    tournament = baseTournament({ status: 'DRAFT' });
    const draft = await request(app)
      .get(`/tournaments/${TOURNEY}`)
      .set('Authorization', await auth(PLAYER, 'PLAYER'));
    expect(draft.status).toBe(404);
  });
});

describe('team entries', () => {
  it('only takes entries while registration is open', async () => {
    tournament = baseTournament({ status: 'DRAFT' });
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/register`)
      .set('Authorization', await auth(CAPTAIN, 'PLAYER'))
      .send({ team_id: TEAM });
    expect(res.status).toBe(409);
  });

  it('refuses entries after the deadline', async () => {
    tournament = baseTournament({ registration_deadline: '2020-01-01' });
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/register`)
      .set('Authorization', await auth(CAPTAIN, 'PLAYER'))
      .send({ team_id: TEAM });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/closed/i);
  });

  it('only a team’s captain can enter it', async () => {
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/register`)
      .set('Authorization', await auth(PLAYER, 'PLAYER'))
      .send({ team_id: TEAM });
    expect(res.status).toBe(403);
  });

  it('a captain’s entry waits for approval and starts unpaid when there is a fee', async () => {
    entries = [entry(ENTRY_A)];
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/register`)
      .set('Authorization', await auth(CAPTAIN, 'PLAYER'))
      .send({ team_id: TEAM });
    expect(res.status).toBe(201);
    expect(inserts.find((i) => i.table === 'tournament_teams')?.rows[0]).toMatchObject({
      status: 'PENDING',
      payment_status: 'UNPAID',
      registered_by: CAPTAIN,
    });
  });

  it('is free to enter when there is no fee', async () => {
    tournament = baseTournament({ entry_fee: '0.00' });
    entries = [entry(ENTRY_A)];
    await request(app)
      .post(`/tournaments/${TOURNEY}/register`)
      .set('Authorization', await auth(CAPTAIN, 'PLAYER'))
      .send({ team_id: TEAM });
    expect(inserts.find((i) => i.table === 'tournament_teams')?.rows[0]).toMatchObject({
      payment_status: 'NOT_REQUIRED',
    });
  });

  it('the organiser adds a team already approved, until it is full', async () => {
    entries = [entry(ENTRY_A)];
    const ok = await request(app)
      .post(`/tournaments/${TOURNEY}/teams`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ team_id: TEAM });
    expect(ok.status).toBe(201);
    expect(inserts.find((i) => i.table === 'tournament_teams')?.rows[0]).toMatchObject({
      status: 'APPROVED',
    });

    approved = 8;
    const full = await request(app)
      .post(`/tournaments/${TOURNEY}/teams`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ team_id: TEAM });
    expect(full.status).toBe(409);
  });

  it('404s a team that does not exist', async () => {
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/teams`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ team_id: GHOST_TEAM });
    expect(res.status).toBe(404);
  });

  it('records an entry fee as paid with a reference, and can undo it', async () => {
    entries = [entry(ENTRY_A)];
    const paid = await request(app)
      .post(`/tournaments/entries/${ENTRY_A}/payment`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ paid: true, reference: 'UPI-8841' });
    expect(paid.status).toBe(200);
    expect(updates.find((u) => u.table === 'tournament_teams')?.values).toMatchObject({
      payment_status: 'PAID',
      payment_reference: 'UPI-8841',
    });

    entries = [entry(ENTRY_A, { payment_status: 'NOT_REQUIRED' })];
    const free = await request(app)
      .post(`/tournaments/entries/${ENTRY_A}/payment`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ paid: true });
    expect(free.status).toBe(409);
  });

  it('approves or rejects, and a captain can withdraw their own entry', async () => {
    entries = [entry(ENTRY_A, { status: 'PENDING', registered_by: CAPTAIN })];
    const review = await request(app)
      .post(`/tournaments/entries/${ENTRY_A}/review`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'))
      .send({ decision: 'APPROVED' });
    expect(review.status).toBe(200);

    const out = await request(app)
      .delete(`/tournaments/entries/${ENTRY_A}`)
      .set('Authorization', await auth(CAPTAIN, 'PLAYER'));
    expect(out.status).toBe(204);

    const stranger = await request(app)
      .delete(`/tournaments/entries/${ENTRY_A}`)
      .set('Authorization', await auth(PLAYER, 'PLAYER'));
    expect(stranger.status).toBe(403);
  });
});

describe('starting', () => {
  it('needs the minimum number of approved teams', async () => {
    entries = [entry(ENTRY_A), entry(ENTRY_B)];
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/start`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(409);
    expect(inserts.find((i) => i.table === 'tournament_fixtures')).toBeUndefined();
  });

  it('builds a round robin and moves to in progress', async () => {
    entries = [entry(ENTRY_A), entry(ENTRY_B), entry(ENTRY_C)];
    const res = await request(app)
      .post(`/tournaments/${TOURNEY}/start`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(res.status).toBe(200);
    const rows = inserts.find((i) => i.table === 'tournament_fixtures')!.rows;
    expect(rows).toHaveLength(3); // 3 teams, one meeting each
    expect(rows.every((f) => f.stage === 'LEAGUE')).toBe(true);
    expect(updates.find((u) => u.table === 'tournaments')?.values).toMatchObject({
      status: 'IN_PROGRESS',
    });
  });

  it('builds a bracket for a knockout', async () => {
    tournament = baseTournament({ format: 'KNOCKOUT' });
    entries = [entry(ENTRY_A), entry(ENTRY_B), entry(ENTRY_C)];
    await request(app)
      .post(`/tournaments/${TOURNEY}/start`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    const rows = inserts.find((i) => i.table === 'tournament_fixtures')!.rows;
    expect(rows).toHaveLength(3); // 2 semi-finals (one a bye) + final
    expect(rows.filter((f) => f.stage === 'KNOCKOUT')).toHaveLength(3);
  });
});

describe('recording results', () => {
  beforeEach(() => {
    tournament = baseTournament({ status: 'IN_PROGRESS' });
    entries = [entry(ENTRY_A), entry(ENTRY_B), entry(ENTRY_C)];
    fixtures = [fixture()];
  });

  const post = async (body: Row, user = OWNER, role = 'TURF_OWNER') =>
    request(app)
      .post(`/tournaments/fixtures/${FIX}/result`)
      .set('Authorization', await auth(user, role))
      .send(body);

  const SCORES = { team_a_runs: 60, team_a_overs: 5.3, team_b_runs: 52, team_b_overs: 6 };

  it('stores balls (5.3 overs = 33) and completes the match', async () => {
    const res = await post({ result_type: 'WIN', winner_entry_id: ENTRY_A, ...SCORES });
    expect(res.status).toBe(204);
    expect(updates.find((u) => u.table === 'tournament_fixtures')?.values).toMatchObject({
      status: 'COMPLETED',
      result_type: 'WIN',
      winner_entry_id: ENTRY_A,
      team_a_runs: 60,
      team_a_balls: 33,
      team_b_balls: 36,
    });
  });

  it('needs a winner for a win, and the winner must be one of the two teams', async () => {
    expect((await post({ result_type: 'WIN', ...SCORES })).status).toBe(400);
    expect((await post({ result_type: 'WIN', winner_entry_id: ENTRY_C, ...SCORES })).status).toBe(
      400,
    );
  });

  it('needs runs and overs for a league match (they decide net run rate)', async () => {
    const res = await post({ result_type: 'WIN', winner_entry_id: ENTRY_A });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/net run rate/i);
  });

  it('a tie or no result has no winner and a no-result needs no scores', async () => {
    expect((await post({ result_type: 'NO_RESULT' })).status).toBe(204);
    expect(updates.find((u) => u.table === 'tournament_fixtures')?.values).toMatchObject({
      winner_entry_id: null,
    });
  });

  it('refuses more overs than the innings allows, and bad ball counts', async () => {
    expect(
      (await post({ result_type: 'WIN', winner_entry_id: ENTRY_A, ...SCORES, team_a_overs: 7 }))
        .status,
    ).toBe(400);
    expect(
      (await post({ result_type: 'WIN', winner_entry_id: ENTRY_A, ...SCORES, team_a_overs: 5.7 }))
        .status,
    ).toBe(400);
  });

  it('refuses a match that is waiting for its teams', async () => {
    fixtures = [fixture({ team_b_entry_id: null })];
    expect((await post({ result_type: 'NO_RESULT' })).status).toBe(409);
  });

  it('a knockout match always needs a winner', async () => {
    fixtures = [fixture({ stage: 'KNOCKOUT', next_match_number: 3, next_slot: 'A' })];
    const res = await post({
      result_type: 'TIE',
      team_a_runs: 40,
      team_a_overs: 6,
      team_b_runs: 40,
      team_b_overs: 6,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/super over/i);
  });

  it('puts a knockout winner into the next round', async () => {
    fixtures = [
      fixture({ stage: 'KNOCKOUT', next_match_number: 3, next_slot: 'B' }),
      fixture({
        fixture_id: 'x2',
        match_number: 3,
        round_number: 2,
        team_a_entry_id: null,
        team_b_entry_id: null,
      }),
    ];
    const res = await post({ result_type: 'WIN', winner_entry_id: ENTRY_B });
    expect(res.status).toBe(204);
    expect(
      updates.find((u) => u.table === 'tournament_fixtures' && 'team_b_entry_id' in u.values)
        ?.values,
    ).toMatchObject({ team_b_entry_id: ENTRY_B });
  });

  it('will not overwrite a recorded result without reopening it', async () => {
    fixtures = [fixture({ status: 'COMPLETED', result_type: 'WIN', winner_entry_id: ENTRY_A })];
    expect((await post({ result_type: 'NO_RESULT' })).status).toBe(409);
  });

  it('only works while the tournament is in progress', async () => {
    tournament = baseTournament({ status: 'COMPLETED' });
    expect((await post({ result_type: 'NO_RESULT' })).status).toBe(409);
  });

  it('is limited to the organiser or an admin', async () => {
    expect((await post({ result_type: 'NO_RESULT' }, OTHER_OWNER)).status).toBe(403);
    expect((await post({ result_type: 'NO_RESULT' }, PLAYER, 'PLAYER')).status).toBe(403);
    expect((await post({ result_type: 'NO_RESULT' }, ADMIN, 'ADMIN')).status).toBe(204);
  });

  it('reopening clears the result; locked once the knockout has begun', async () => {
    fixtures = [fixture({ status: 'COMPLETED', result_type: 'WIN', winner_entry_id: ENTRY_A })];
    const ok = await request(app)
      .post(`/tournaments/fixtures/${FIX}/reopen`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(ok.status).toBe(204);
    expect(updates.find((u) => u.table === 'tournament_fixtures')?.values).toMatchObject({
      status: 'SCHEDULED',
      result_type: null,
    });

    updates.length = 0;
    fixtures = [
      fixture({ status: 'COMPLETED', result_type: 'WIN', winner_entry_id: ENTRY_A }),
      fixture({ fixture_id: 'ko', stage: 'KNOCKOUT', match_number: 4 }),
    ];
    const locked = await request(app)
      .post(`/tournaments/fixtures/${FIX}/reopen`)
      .set('Authorization', await auth(OWNER, 'TURF_OWNER'));
    expect(locked.status).toBe(409);
    expect(updates).toHaveLength(0);
  });
});
