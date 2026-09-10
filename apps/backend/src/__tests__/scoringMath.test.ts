// Unit tests for the pure ball-event -> score/innings-total calculation
// logic (module 2.8, PRD §12.18), including undo. No DB/transaction
// involved — see scoringTransaction.test.ts for the transactional wrapper.

import {
  applyBall,
  computeAudioTrigger,
  isLegalDelivery,
  legalBallsToOversNotation,
  officialRunsForBall,
  oversNotationToLegalBalls,
  positionForNextBall,
  reverseBall,
  runsConcededForBall,
  totalRunsForBall,
  type BallInput,
  type InningsTotals,
} from '../domain/scoring';

function ball(overrides: Partial<BallInput> = {}): BallInput {
  return {
    runs_scored: 0,
    extra_type: 'NONE',
    extra_runs: 0,
    is_wicket: false,
    wicket_type: null,
    ...overrides,
  };
}

const ZERO: InningsTotals = { total_runs: 0, total_wickets: 0, legal_balls: 0 };

describe('isLegalDelivery', () => {
  it('WIDE and NO_BALL are not legal deliveries; everything else is', () => {
    expect(isLegalDelivery('WIDE')).toBe(false);
    expect(isLegalDelivery('NO_BALL')).toBe(false);
    expect(isLegalDelivery('NONE')).toBe(true);
    expect(isLegalDelivery('BYE')).toBe(true);
    expect(isLegalDelivery('LEG_BYE')).toBe(true);
  });
});

describe('totalRunsForBall / runsConcededForBall', () => {
  it('a normal boundary counts fully for both team total and bowler figures', () => {
    const b = ball({ runs_scored: 4 });
    expect(totalRunsForBall(b)).toBe(4);
    expect(runsConcededForBall(b)).toBe(4);
  });

  it('byes/leg-byes count for the team total but not against the bowler', () => {
    const b = ball({ runs_scored: 0, extra_type: 'BYE', extra_runs: 2 });
    expect(totalRunsForBall(b)).toBe(2);
    expect(runsConcededForBall(b)).toBe(0);
  });

  it('a wide adds its extra run to both the team total and the bowler figures', () => {
    const b = ball({ extra_type: 'WIDE', extra_runs: 1 });
    expect(totalRunsForBall(b)).toBe(1);
    expect(runsConcededForBall(b)).toBe(1);
  });
});

// Backlog A-8: "extras count toward the score" toggle. Extras are always
// recorded on the ball (score_events keeps the raw truth); this only
// controls whether they move the *official* team total.
describe('officialRunsForBall (backlog A-8 extras toggle)', () => {
  it('with the toggle on, behaves exactly like totalRunsForBall', () => {
    const wide = ball({ extra_type: 'WIDE', extra_runs: 1 });
    const bye = ball({ extra_type: 'BYE', extra_runs: 2 });
    const four = ball({ runs_scored: 4 });
    expect(officialRunsForBall(wide, true)).toBe(totalRunsForBall(wide));
    expect(officialRunsForBall(bye, true)).toBe(totalRunsForBall(bye));
    expect(officialRunsForBall(four, true)).toBe(totalRunsForBall(four));
  });

  it('with the toggle off, extras contribute nothing but bat runs still do', () => {
    expect(officialRunsForBall(ball({ extra_type: 'WIDE', extra_runs: 1 }), false)).toBe(0);
    expect(officialRunsForBall(ball({ extra_type: 'NO_BALL', extra_runs: 1 }), false)).toBe(0);
    expect(officialRunsForBall(ball({ extra_type: 'BYE', extra_runs: 4 }), false)).toBe(0);
    expect(officialRunsForBall(ball({ extra_type: 'LEG_BYE', extra_runs: 1 }), false)).toBe(0);
    expect(officialRunsForBall(ball({ runs_scored: 4 }), false)).toBe(4);
    // A no-ball hit for four: the no-ball extra is dropped, the batter's 4 still counts.
    expect(
      officialRunsForBall(ball({ runs_scored: 4, extra_type: 'NO_BALL', extra_runs: 1 }), false),
    ).toBe(4);
  });
});

describe('applyBall / reverseBall respect the extras toggle', () => {
  it('applyBall omits extras from the official total when the toggle is off', () => {
    const next = applyBall(ZERO, ball({ extra_type: 'WIDE', extra_runs: 1 }), false);
    expect(next).toEqual({ total_runs: 0, total_wickets: 0, legal_balls: 0 });
  });

  it('reverseBall with the toggle off is still the exact inverse of applyBall', () => {
    const b = ball({ runs_scored: 1, extra_type: 'BYE', extra_runs: 3 });
    const after = applyBall(ZERO, b, false);
    expect(reverseBall(after, b, false)).toEqual(ZERO);
  });

  it('bowler figures (runsConcededForBall) are unaffected by the toggle either way', () => {
    const wide = ball({ extra_type: 'WIDE', extra_runs: 1 });
    expect(runsConcededForBall(wide)).toBe(1); // unchanged regardless of the display toggle
  });
});

describe('applyBall / reverseBall (undo)', () => {
  it('a dot ball changes nothing but legal_balls', () => {
    const next = applyBall(ZERO, ball());
    expect(next).toEqual({ total_runs: 0, total_wickets: 0, legal_balls: 1 });
  });

  it('a six updates runs and legal_balls, not wickets', () => {
    const next = applyBall(ZERO, ball({ runs_scored: 6 }));
    expect(next).toEqual({ total_runs: 6, total_wickets: 0, legal_balls: 1 });
  });

  it('a wicket increments total_wickets and still counts as a legal ball', () => {
    const next = applyBall(ZERO, ball({ is_wicket: true, wicket_type: 'BOWLED' }));
    expect(next).toEqual({ total_runs: 0, total_wickets: 1, legal_balls: 1 });
  });

  it('a run-out with runs completed adds both the runs and the wicket', () => {
    const next = applyBall(ZERO, ball({ runs_scored: 1, is_wicket: true, wicket_type: 'RUN_OUT' }));
    expect(next).toEqual({ total_runs: 1, total_wickets: 1, legal_balls: 1 });
  });

  it('a wide does not advance legal_balls but does add runs', () => {
    const next = applyBall(ZERO, ball({ extra_type: 'WIDE', extra_runs: 1 }));
    expect(next).toEqual({ total_runs: 1, total_wickets: 0, legal_balls: 0 });
  });

  it('reverseBall is the exact inverse of applyBall for every ball type', () => {
    const scenarios: BallInput[] = [
      ball(),
      ball({ runs_scored: 4 }),
      ball({ runs_scored: 6 }),
      ball({ is_wicket: true, wicket_type: 'CAUGHT' }),
      ball({ runs_scored: 1, is_wicket: true, wicket_type: 'RUN_OUT' }),
      ball({ extra_type: 'WIDE', extra_runs: 1 }),
      ball({ extra_type: 'NO_BALL', extra_runs: 1, runs_scored: 2 }),
      ball({ extra_type: 'BYE', extra_runs: 3 }),
      ball({ extra_type: 'LEG_BYE', extra_runs: 1 }),
    ];
    const start: InningsTotals = { total_runs: 42, total_wickets: 3, legal_balls: 27 };

    for (const scenario of scenarios) {
      const after = applyBall(start, scenario);
      const undone = reverseBall(after, scenario);
      expect(undone).toEqual(start);
    }
  });

  it('an entire realistic over reduces back to zero when undone ball-by-ball in reverse', () => {
    const over: BallInput[] = [
      ball({ runs_scored: 1 }),
      ball({ extra_type: 'WIDE', extra_runs: 1 }),
      ball({ runs_scored: 4 }),
      ball({ is_wicket: true, wicket_type: 'BOWLED' }),
      ball({ runs_scored: 0 }),
      ball({ extra_type: 'BYE', extra_runs: 1 }),
      ball({ runs_scored: 6 }),
    ];

    let totals = ZERO;
    const history: InningsTotals[] = [totals];
    for (const b of over) {
      totals = applyBall(totals, b);
      history.push(totals);
    }

    // Undo every ball in reverse order — each undo must land exactly back
    // on the totals from just before that ball was bowled.
    for (let i = over.length - 1; i >= 0; i--) {
      totals = reverseBall(totals, over[i]);
      expect(totals).toEqual(history[i]);
    }
    expect(totals).toEqual(ZERO);
  });
});

describe('over/ball position and notation conversion', () => {
  it('positionForNextBall computes over/ball from legal balls bowled so far', () => {
    expect(positionForNextBall(0)).toEqual({ over_number: 0, ball_number_in_over: 1 });
    expect(positionForNextBall(5)).toEqual({ over_number: 0, ball_number_in_over: 6 });
    expect(positionForNextBall(6)).toEqual({ over_number: 1, ball_number_in_over: 1 });
    expect(positionForNextBall(29)).toEqual({ over_number: 4, ball_number_in_over: 6 });
  });

  it('an illegal delivery (wide/no-ball) is recorded at the *current* position, not advanced', () => {
    // 7 legal balls bowled (1 over + 1 ball); an 8th delivery that's a
    // wide is still "over 1, ball 2" since it doesn't count.
    expect(positionForNextBall(7)).toEqual({ over_number: 1, ball_number_in_over: 2 });
  });

  it('legalBallsToOversNotation matches cricket X.Y notation, not true decimal overs', () => {
    expect(legalBallsToOversNotation(0)).toBe(0);
    expect(legalBallsToOversNotation(5)).toBe(0.5);
    expect(legalBallsToOversNotation(6)).toBe(1);
    expect(legalBallsToOversNotation(29)).toBe(4.5);
  });

  it('oversNotationToLegalBalls is the exact inverse of legalBallsToOversNotation', () => {
    for (const legalBalls of [0, 1, 5, 6, 7, 29, 47]) {
      expect(oversNotationToLegalBalls(legalBallsToOversNotation(legalBalls))).toBe(legalBalls);
    }
  });
});

describe('computeAudioTrigger (server-side, PRD §12.63)', () => {
  const base = {
    strikerRunsBeforeBall: 10,
    strikerRunsAfterBall: 10,
    bowlerConsecutiveWickets: 0,
    isMatchWinningBall: false,
  };

  it('a plain single triggers no sound', () => {
    expect(computeAudioTrigger(ball({ runs_scored: 1 }), base)).toBe('NONE');
  });

  it('a six triggers SIX', () => {
    expect(computeAudioTrigger(ball({ runs_scored: 6 }), base)).toBe('SIX');
  });

  it('a four triggers FOUR', () => {
    expect(computeAudioTrigger(ball({ runs_scored: 4 }), base)).toBe('FOUR');
  });

  it('4 leg-byes is not a FOUR trigger — the striker did not hit a boundary', () => {
    expect(
      computeAudioTrigger(ball({ runs_scored: 0, extra_type: 'LEG_BYE', extra_runs: 4 }), base),
    ).toBe('NONE');
  });

  it('a wicket triggers WICKET (when not a hat-trick)', () => {
    expect(computeAudioTrigger(ball({ is_wicket: true, wicket_type: 'BOWLED' }), base)).toBe(
      'WICKET',
    );
  });

  it('a third consecutive wicket triggers HAT_TRICK instead of WICKET', () => {
    expect(
      computeAudioTrigger(ball({ is_wicket: true, wicket_type: 'BOWLED' }), {
        ...base,
        bowlerConsecutiveWickets: 3,
      }),
    ).toBe('HAT_TRICK');
  });

  it('crossing 50 triggers FIFTY', () => {
    expect(
      computeAudioTrigger(ball({ runs_scored: 4 }), {
        ...base,
        strikerRunsBeforeBall: 48,
        strikerRunsAfterBall: 52,
      }),
    ).toBe('FIFTY');
  });

  it('crossing 100 triggers CENTURY, taking priority over FIFTY logic', () => {
    expect(
      computeAudioTrigger(ball({ runs_scored: 4 }), {
        ...base,
        strikerRunsBeforeBall: 98,
        strikerRunsAfterBall: 102,
      }),
    ).toBe('CENTURY');
  });

  it('the match-winning ball triggers MATCH_WON above everything else', () => {
    expect(
      computeAudioTrigger(ball({ runs_scored: 6 }), { ...base, isMatchWinningBall: true }),
    ).toBe('MATCH_WON');
  });
});
