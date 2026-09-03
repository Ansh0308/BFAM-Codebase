// Unit tests for the pure score_events -> player_match_statistics
// aggregation logic (module 2.10, PRD §12.21). No DB involved — see
// statisticsService.ts for the transactional wrapper that reads events and
// upserts the result; this file is what makes that job's output exactly
// reproducible.

import { computeMatchStatistics, type StatEventInput } from '../domain/statistics';

function event(overrides: Partial<StatEventInput> = {}): StatEventInput {
  return {
    striker_player_id: 'A',
    bowler_player_id: 'X',
    runs_scored: 0,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    fielder_player_id: null,
    ...overrides,
  };
}

describe('computeMatchStatistics — batting', () => {
  it('accumulates runs, balls faced, fours and sixes for the striker', () => {
    const lines = computeMatchStatistics([
      event({ runs_scored: 1 }),
      event({ runs_scored: 4 }),
      event({ runs_scored: 6 }),
      event({ runs_scored: 0 }),
    ]);
    expect(lines.get('A')).toMatchObject({
      runs_scored: 11,
      balls_faced: 4,
      fours: 1,
      sixes: 1,
    });
  });

  it('a wide does not count as a ball faced, but its run(s) still count', () => {
    const lines = computeMatchStatistics([event({ extra_type: 'WIDE', extra_runs: 1 })]);
    expect(lines.get('A')).toMatchObject({ runs_scored: 0, balls_faced: 0 });
  });

  it('4/6 runs via bye/leg-bye are not credited as boundaries (no bat contact)', () => {
    const lines = computeMatchStatistics([
      event({ runs_scored: 0, extra_type: 'BYE', extra_runs: 4 }),
    ]);
    expect(lines.get('A')).toMatchObject({ runs_scored: 0, fours: 0, balls_faced: 1 });
  });

  it('strike rate is runs/balls*100, rounded to 2dp, and null with zero balls faced', () => {
    const lines = computeMatchStatistics([
      event({ runs_scored: 1 }),
      event({ runs_scored: 1 }),
      event({ runs_scored: 1 }),
    ]);
    expect(lines.get('A')!.strike_rate).toBe(100);

    const noBalls = computeMatchStatistics([]);
    expect(noBalls.size).toBe(0);
  });
});

describe('computeMatchStatistics — bowling', () => {
  it('accumulates runs conceded and legal-ball-derived overs for the bowler', () => {
    const lines = computeMatchStatistics([
      event({ bowler_player_id: 'X', runs_scored: 4 }),
      event({ bowler_player_id: 'X', runs_scored: 1 }),
      event({ bowler_player_id: 'X', extra_type: 'WIDE', extra_runs: 1 }),
    ]);
    const bowl = lines.get('X')!;
    expect(bowl.runs_conceded).toBe(6);
    // Only 2 of the 3 deliveries were legal (the wide doesn't count).
    expect(bowl.overs_bowled).toBe(0.2);
  });

  it('byes/leg-byes count for the team but are excluded from runs_conceded', () => {
    const lines = computeMatchStatistics([
      event({ bowler_player_id: 'X', extra_type: 'BYE', extra_runs: 3 }),
    ]);
    expect(lines.get('X')!.runs_conceded).toBe(0);
  });

  it('a bowled/caught/lbw wicket is credited to the bowler; a run-out is not', () => {
    const lines = computeMatchStatistics([
      event({ bowler_player_id: 'X', is_wicket: true, wicket_type: 'BOWLED' }),
      event({
        bowler_player_id: 'X',
        is_wicket: true,
        wicket_type: 'RUN_OUT',
        fielder_player_id: 'F',
      }),
    ]);
    expect(lines.get('X')!.wickets_taken).toBe(1);
  });

  it('economy is runs conceded per over, rounded to 2dp, and null with no legal balls bowled', () => {
    const lines = computeMatchStatistics(
      Array.from({ length: 6 }, () => event({ bowler_player_id: 'X', runs_scored: 2 })),
    );
    expect(lines.get('X')!.economy_rate).toBe(12);

    const onlyWide = computeMatchStatistics([
      event({ bowler_player_id: 'X', extra_type: 'WIDE', extra_runs: 1 }),
    ]);
    expect(onlyWide.get('X')!.economy_rate).toBeNull();
  });
});

describe('computeMatchStatistics — fielding', () => {
  it('credits a catch to the fielder, not the bowler', () => {
    const lines = computeMatchStatistics([
      event({
        bowler_player_id: 'X',
        is_wicket: true,
        wicket_type: 'CAUGHT',
        fielder_player_id: 'F',
      }),
    ]);
    expect(lines.get('F')!.catches).toBe(1);
    expect(lines.get('X')!.catches).toBe(0);
  });

  it('credits a run-out and a stumping to the fielder distinctly', () => {
    const lines = computeMatchStatistics([
      event({ is_wicket: true, wicket_type: 'RUN_OUT', fielder_player_id: 'F' }),
      event({ is_wicket: true, wicket_type: 'STUMPED', fielder_player_id: 'F' }),
    ]);
    const f = lines.get('F')!;
    expect(f.run_outs).toBe(1);
    expect(f.stumpings).toBe(1);
    expect(f.catches).toBe(0);
  });

  it('a wicket with no fielder recorded (e.g. bowled) credits no fielding stat to anyone', () => {
    const lines = computeMatchStatistics([event({ is_wicket: true, wicket_type: 'BOWLED' })]);
    expect(Array.from(lines.values()).every((l) => l.catches === 0 && l.run_outs === 0)).toBe(true);
  });
});

describe('computeMatchStatistics — idempotency', () => {
  it('is a pure function: the same events always produce the same lines', () => {
    const events = [
      event({ striker_player_id: 'A', bowler_player_id: 'X', runs_scored: 4 }),
      event({
        striker_player_id: 'A',
        bowler_player_id: 'X',
        is_wicket: true,
        wicket_type: 'CAUGHT',
        fielder_player_id: 'F',
      }),
    ];
    const first = computeMatchStatistics(events);
    const second = computeMatchStatistics(events);
    expect(Array.from(first.entries())).toEqual(Array.from(second.entries()));
  });
});
