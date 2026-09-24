import {
  advanceCrease,
  ballLabel,
  legalBallsFromOvers,
  restoreCrease,
  runsRun,
  type BallLike,
} from '../src/lib/crease';
import type { LiveScore } from '@bfam/shared-types';

const ball = (over: Partial<BallLike>): BallLike => ({
  runs_scored: 0,
  extra_type: 'NONE',
  extra_runs: 0,
  is_wicket: false,
  ...over,
});
const two = { strikerId: 'a', nonStrikerId: 'b' };

describe('runsRun', () => {
  it('counts runs the batters ran per delivery type', () => {
    expect(runsRun(ball({ runs_scored: 3 }))).toBe(3);
    expect(runsRun(ball({ extra_type: 'WIDE', extra_runs: 3 }))).toBe(2); // wd + 2 run
    expect(runsRun(ball({ extra_type: 'WIDE', extra_runs: 1 }))).toBe(0);
    expect(runsRun(ball({ extra_type: 'BYE', extra_runs: 1 }))).toBe(1);
    expect(runsRun(ball({ extra_type: 'LEG_BYE', extra_runs: 2 }))).toBe(2);
  });
});

describe('legalBallsFromOvers', () => {
  it('converts X.Y notation to legal balls', () => {
    expect(legalBallsFromOvers(0)).toBe(0);
    expect(legalBallsFromOvers(1.3)).toBe(9);
    expect(legalBallsFromOvers(2)).toBe(12);
  });
});

describe('advanceCrease', () => {
  it('swaps after an odd number of runs, not after an even number', () => {
    expect(
      advanceCrease(two, ball({ runs_scored: 1 }), { singleBatter: false, overEnded: false }),
    ).toEqual({
      strikerId: 'b',
      nonStrikerId: 'a',
    });
    expect(
      advanceCrease(two, ball({ runs_scored: 4 }), { singleBatter: false, overEnded: false }),
    ).toEqual(two);
  });

  it('changes ends at the end of an over (and an odd run at over end cancels it out)', () => {
    expect(
      advanceCrease(two, ball({ runs_scored: 0 }), { singleBatter: false, overEnded: true }),
    ).toEqual({
      strikerId: 'b',
      nonStrikerId: 'a',
    });
    expect(
      advanceCrease(two, ball({ runs_scored: 1 }), { singleBatter: false, overEnded: true }),
    ).toEqual(two);
  });

  it('never swaps in single-batter mode', () => {
    const one = { strikerId: 'a', nonStrikerId: null };
    expect(
      advanceCrease(one, ball({ runs_scored: 1 }), { singleBatter: true, overEnded: true }),
    ).toEqual(one);
  });

  it('clears whoever was dismissed and leaves the other end alone', () => {
    const w = (id: string) => ball({ is_wicket: true, dismissed_player_id: id });
    expect(advanceCrease(two, w('a'), { singleBatter: false, overEnded: false })).toEqual({
      strikerId: null,
      nonStrikerId: 'b',
    });
    expect(advanceCrease(two, w('b'), { singleBatter: false, overEnded: false })).toEqual({
      strikerId: 'a',
      nonStrikerId: null,
    });
    expect(
      advanceCrease({ strikerId: 'a', nonStrikerId: null }, ball({ is_wicket: true }), {
        singleBatter: true,
        overEnded: false,
      }),
    ).toEqual({
      strikerId: null,
      nonStrikerId: null,
    });
  });
});

describe('restoreCrease', () => {
  const live = (over: Partial<LiveScore>): LiveScore =>
    ({
      match_id: 'm',
      innings: { overs_completed: 0.1 },
      current_striker_player_id: 'a',
      current_non_striker_player_id: 'b',
      last_ball: ball({ runs_scored: 1 }),
      no_non_striker: false,
      ...over,
    }) as unknown as LiveScore;

  it('applies the last ball to the last recorded pair', () => {
    expect(restoreCrease(live({}))).toEqual({ strikerId: 'b', nonStrikerId: 'a' });
  });

  it('applies the end-of-over change when the last legal ball finished an over', () => {
    expect(
      restoreCrease(
        live({ innings: { overs_completed: 1 } as LiveScore['innings'], last_ball: ball({}) }),
      ),
    ).toEqual({ strikerId: 'b', nonStrikerId: 'a' });
  });

  it('does not treat a wide as finishing the over', () => {
    expect(
      restoreCrease(
        live({
          innings: { overs_completed: 1 } as LiveScore['innings'],
          last_ball: ball({ extra_type: 'WIDE', extra_runs: 1 }),
        }),
      ),
    ).toEqual(two);
  });

  it('returns nobody at the crease before the first ball', () => {
    expect(restoreCrease(live({ last_ball: null, current_striker_player_id: null }))).toEqual({
      strikerId: null,
      nonStrikerId: null,
    });
  });

  it('leaves the dismissed end empty after a wicket', () => {
    expect(
      restoreCrease(live({ last_ball: ball({ is_wicket: true, dismissed_player_id: 'a' }) })),
    ).toEqual({ strikerId: null, nonStrikerId: 'b' });
  });
});

describe('ballLabel', () => {
  it('labels each kind of ball', () => {
    expect(ballLabel(ball({ is_wicket: true }))).toBe('W');
    expect(ballLabel(ball({}))).toBe('•');
    expect(ballLabel(ball({ runs_scored: 4 }))).toBe('4');
    expect(ballLabel(ball({ extra_type: 'WIDE', extra_runs: 3 }))).toBe('wd+2');
    expect(ballLabel(ball({ extra_type: 'LEG_BYE', extra_runs: 1 }))).toBe('1lb');
  });
});
