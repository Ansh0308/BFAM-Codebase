// Integration test for module 2.8's core atomicity guarantee (PRD §12.18
// requirement 6): every score_events insert and its innings-total update
// happen in one transaction, and never drift out of sync under concurrent
// scorer actions. The fake `sequelize` below simulates real MySQL row
// locking for `... FOR UPDATE` queries (a per-innings async mutex,
// acquired on the FOR UPDATE read and released when that transaction's
// callback settles) — without that simulated lock, two "concurrent" calls
// in this test would race exactly as they would with a buggy
// (non-locking) implementation against a real database, so this
// meaningfully exercises the serialization scoringService relies on
// MySQL to provide in production.

interface MatchRow {
  match_id: string;
  organizer_id: string;
  assigned_scorer_id: string | null;
  scoring_mode: string;
  match_status: string;
}
interface InningsRow {
  innings_id: string;
  match_id: string;
  innings_number: number;
  batting_match_team_id: string;
  bowling_match_team_id: string;
  total_runs: number;
  total_wickets: number;
  overs_completed: number;
  innings_status: string;
  target_runs: number | null;
}
interface ScoreEventRow {
  score_event_id: string;
  innings_id: string;
  over_number: number;
  ball_number_in_over: number;
  sequence_number: number;
  striker_player_id: string;
  non_striker_player_id: string | null;
  bowler_player_id: string;
  runs_scored: number;
  extra_type: string;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: string | null;
  audio_trigger: string;
  is_corrected: boolean;
}

let matches: MatchRow[] = [];
let innings: InningsRow[] = [];
let scoreEvents: ScoreEventRow[] = [];

const rowLocks = new Map<string, Promise<void>>();
async function acquireLock(key: string): Promise<() => void> {
  const prev = rowLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const thisLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  rowLocks.set(
    key,
    prev.then(() => thisLock),
  );
  await prev;
  return release;
}

interface TxCtx {
  releases: (() => void)[];
}

jest.mock('../config/sequelize', () => {
  return {
    sequelize: {
      query: async (
        sql: string,
        options: { replacements?: Record<string, unknown>; transaction?: TxCtx } = {},
      ) => {
        const r = options.replacements ?? {};

        if (sql.includes('FROM matches WHERE match_id')) {
          const m = matches.find((x) => x.match_id === r.matchId);
          return m ? [m] : [];
        }
        if (sql.includes('SELECT match_id FROM innings WHERE innings_id')) {
          const i = innings.find((x) => x.innings_id === r.inningsId);
          return i ? [{ match_id: i.match_id }] : [];
        }
        if (sql.includes('FROM innings WHERE innings_id = :inningsId FOR UPDATE')) {
          const release = await acquireLock(r.inningsId as string);
          options.transaction?.releases.push(release);
          const i = innings.find((x) => x.innings_id === r.inningsId);
          return i ? [i] : [];
        }
        if (
          sql.includes('FROM innings WHERE innings_id = :inningsId') &&
          !sql.includes('FOR UPDATE')
        ) {
          const i = innings.find((x) => x.innings_id === r.inningsId);
          return i ? [i] : [];
        }
        if (sql.includes('MAX(sequence_number)')) {
          const rows = scoreEvents.filter((e) => e.innings_id === r.inningsId);
          const max = rows.length > 0 ? Math.max(...rows.map((e) => e.sequence_number)) : null;
          return [{ maxSeq: max }];
        }
        if (
          sql.includes('FROM score_events WHERE innings_id') &&
          sql.includes('ORDER BY sequence_number DESC LIMIT 1')
        ) {
          const rows = scoreEvents
            .filter((e) => e.innings_id === r.inningsId && !e.is_corrected)
            .sort((a, b) => b.sequence_number - a.sequence_number);
          return rows.length > 0 ? [rows[0]] : [];
        }
        if (
          sql.includes('FROM score_events WHERE innings_id') &&
          sql.includes('ORDER BY sequence_number ASC')
        ) {
          return scoreEvents
            .filter((e) => e.innings_id === r.inningsId && !e.is_corrected)
            .sort((a, b) => a.sequence_number - b.sequence_number);
        }

        throw new Error(`Unexpected query in test fake: ${sql}`);
      },
      transaction: async (fn: (t: TxCtx) => Promise<unknown>) => {
        const ctx: TxCtx = { releases: [] };
        try {
          return await fn(ctx);
        } finally {
          for (const release of ctx.releases) release();
        }
      },
      getQueryInterface: () => ({
        bulkInsert: async (table: string, rows: Array<Record<string, unknown>>) => {
          if (table === 'score_events') scoreEvents.push(...(rows as unknown as ScoreEventRow[]));
        },
        bulkUpdate: async (
          table: string,
          values: Record<string, unknown>,
          where: Record<string, unknown>,
        ) => {
          if (table === 'innings') {
            const row = innings.find((x) => x.innings_id === where.innings_id);
            if (row) Object.assign(row, values);
          }
          if (table === 'score_events') {
            const row = scoreEvents.find((x) => x.score_event_id === where.score_event_id);
            if (row) Object.assign(row, values);
          }
        },
      }),
    },
  };
});

jest.mock('../realtime/io', () => ({
  getIo: () => null,
  matchRoom: (id: string) => `match:${id}`,
}));

import { recordBall, undoLastBall } from '../services/scoringService';

const MATCH_ID = 'match-1';
const INNINGS_ID = 'innings-1';
const ORGANIZER_USER = 'organizer-user';
const STRIKER = 'striker-player';
const NON_STRIKER = 'non-striker-player';
const BOWLER = 'bowler-player';

function normalBall(runs: number) {
  return {
    striker_player_id: STRIKER,
    non_striker_player_id: NON_STRIKER,
    bowler_player_id: BOWLER,
    runs_scored: runs,
    extra_type: 'NONE' as const,
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
  };
}

describe('Live Scoring transaction atomicity under concurrency (module 2.8)', () => {
  beforeEach(() => {
    matches = [
      {
        match_id: MATCH_ID,
        organizer_id: ORGANIZER_USER,
        assigned_scorer_id: null,
        scoring_mode: 'PLAYER_MANAGED',
        match_status: 'IN_PROGRESS',
      },
    ];
    innings = [
      {
        innings_id: INNINGS_ID,
        match_id: MATCH_ID,
        innings_number: 1,
        batting_match_team_id: 'mt-a',
        bowling_match_team_id: 'mt-b',
        total_runs: 0,
        total_wickets: 0,
        overs_completed: 0,
        innings_status: 'IN_PROGRESS',
        target_runs: null,
      },
    ];
    scoreEvents = [];
    rowLocks.clear();
  });

  it('two balls recorded concurrently for the same innings never lose an update — both are reflected exactly once', async () => {
    const [first, second] = await Promise.all([
      recordBall(INNINGS_ID, ORGANIZER_USER, normalBall(4)),
      recordBall(INNINGS_ID, ORGANIZER_USER, normalBall(6)),
    ]);

    // Sequence numbers must be distinct (the row lock prevented both
    // reading the same MAX(sequence_number) and colliding).
    expect(first.event.sequence_number).not.toBe(second.event.sequence_number);
    expect([first.event.sequence_number, second.event.sequence_number].sort()).toEqual([1, 2]);

    // Both balls' runs are present in the final total — 4 + 6 = 10, not
    // just whichever call's write "won" a lost-update race.
    const finalInnings = innings.find((i) => i.innings_id === INNINGS_ID)!;
    expect(finalInnings.total_runs).toBe(10);
    expect(scoreEvents).toHaveLength(2);
  });

  it('ten balls recorded concurrently all land with unique, gapless sequence numbers and a correctly summed total', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => recordBall(INNINGS_ID, ORGANIZER_USER, normalBall(1))),
    );

    const sequenceNumbers = results.map((r) => r.event.sequence_number).sort((a, b) => a - b);
    expect(sequenceNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const finalInnings = innings.find((i) => i.innings_id === INNINGS_ID)!;
    expect(finalInnings.total_runs).toBe(10);
    expect(finalInnings.overs_completed).toBe(1.4); // 10 legal balls = 1 over, 4 balls
  });

  it('undo concurrent with a new ball still lands on a consistent final state (serialized, not interleaved)', async () => {
    await recordBall(INNINGS_ID, ORGANIZER_USER, normalBall(4));

    const [undoResult, ballResult] = await Promise.all([
      undoLastBall(INNINGS_ID, ORGANIZER_USER),
      recordBall(INNINGS_ID, ORGANIZER_USER, normalBall(2)),
    ]);

    expect(undoResult.undone_event_id).toBeTruthy();
    expect(ballResult.event.sequence_number).toBe(2);

    // Whichever order the lock granted them, the end state is internally
    // consistent: exactly one non-corrected event, and its total_runs
    // matches the innings row exactly (no drift between the ledger and
    // the cached totals).
    const finalInnings = innings.find((i) => i.innings_id === INNINGS_ID)!;
    const activeEvents = scoreEvents.filter((e) => !e.is_corrected);
    const expectedTotal = activeEvents.reduce((sum, e) => sum + e.runs_scored + e.extra_runs, 0);
    expect(finalInnings.total_runs).toBe(expectedTotal);
  });

  it('rejects a non-organizer, non-scorer from recording a ball', async () => {
    await expect(recordBall(INNINGS_ID, 'some-random-user', normalBall(4))).rejects.toThrow(
      'Only the match organizer or assigned scorer can record balls.',
    );
    expect(scoreEvents).toHaveLength(0);
  });

  it('a turf-staff-managed match rejects even the organizer if they are not the assigned scorer', async () => {
    matches[0].scoring_mode = 'TURF_STAFF_MANAGED';
    matches[0].assigned_scorer_id = 'the-real-scorer';

    await expect(recordBall(INNINGS_ID, ORGANIZER_USER, normalBall(4))).rejects.toThrow(
      'Only the assigned scorer can record balls for this match.',
    );
  });
});
