// Pure unit tests for domain/matchStreaks.ts (long tail — Match Streaks,
// PRD §12.38). No database involved. All dates are UTC; weeks run
// Monday-Sunday.

import { computeMatchStreaks } from '../domain/matchStreaks';

// A Wednesday, used as a stable "now" reference for current-streak tests.
const NOW = new Date('2026-09-23T12:00:00Z');

describe('computeMatchStreaks (long tail — Match Streaks)', () => {
  it('returns zero streaks for a player with no completed matches', () => {
    const result = computeMatchStreaks([], NOW);
    expect(result).toEqual({ current_streak: 0, best_streak: 0, participated_week_starts: [] });
  });

  it('counts one match this week as a current streak of 1', () => {
    const result = computeMatchStreaks([new Date('2026-09-22T00:00:00Z')], NOW);
    expect(result.current_streak).toBe(1);
    expect(result.best_streak).toBe(1);
  });

  it('multiple matches in the same week still count as one participated week', () => {
    const result = computeMatchStreaks(
      [new Date('2026-09-21T00:00:00Z'), new Date('2026-09-23T00:00:00Z')],
      NOW,
    );
    expect(result.participated_week_starts).toHaveLength(1);
  });

  it('builds a current streak across consecutive weeks', () => {
    const result = computeMatchStreaks(
      [
        new Date('2026-09-08T00:00:00Z'), // week of Sep 7
        new Date('2026-09-15T00:00:00Z'), // week of Sep 14
        new Date('2026-09-21T00:00:00Z'), // week of Sep 21 (this week)
      ],
      NOW,
    );
    expect(result.current_streak).toBe(3);
    expect(result.best_streak).toBe(3);
  });

  it('keeps the streak alive if the player played last week but not yet this week', () => {
    const result = computeMatchStreaks(
      [new Date('2026-09-08T00:00:00Z'), new Date('2026-09-14T00:00:00Z')],
      NOW, // "now" is the week after Sep 14's week
    );
    expect(result.current_streak).toBe(2);
  });

  it('breaks the current streak after missing two weeks, but preserves best_streak', () => {
    const result = computeMatchStreaks(
      [
        new Date('2026-08-10T00:00:00Z'), // a streak long ago
        new Date('2026-08-17T00:00:00Z'),
        new Date('2026-08-24T00:00:00Z'),
        // gap of several weeks, nothing played recently
      ],
      NOW,
    );
    expect(result.current_streak).toBe(0);
    expect(result.best_streak).toBe(3);
  });

  it('finds the longest run of consecutive weeks, not just the most recent one', () => {
    const result = computeMatchStreaks(
      [
        // A 4-week streak in the past...
        new Date('2026-07-06T00:00:00Z'),
        new Date('2026-07-13T00:00:00Z'),
        new Date('2026-07-20T00:00:00Z'),
        new Date('2026-07-27T00:00:00Z'),
        // ...then a gap, then a shorter 2-week streak leading into "now".
        new Date('2026-09-14T00:00:00Z'),
        new Date('2026-09-21T00:00:00Z'),
      ],
      NOW,
    );
    expect(result.best_streak).toBe(4);
    expect(result.current_streak).toBe(2);
  });
});
