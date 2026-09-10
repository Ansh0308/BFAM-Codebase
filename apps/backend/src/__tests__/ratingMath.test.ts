// Unit tests for the pure Basic Skill Rating calculation (module 2.10, PRD
// §12.29). No DB involved — this is what makes the number shown on the
// Player Profile screen exactly reproducible from a match's own
// statistics.

import {
  applyRatingDelta,
  applyReliabilityDelta,
  BASELINE_RELIABILITY_SCORE,
  BASELINE_SKILL_RATING,
  computeFairPlayRatingDelta,
  computeMatchPerformanceRatingDelta,
  computeParticipationFairness,
  computeReliabilityScore,
  computeSkillRating,
  MAX_RELIABILITY_SCORE,
  MAX_SKILL_RATING,
  MIN_RELIABILITY_SCORE,
  MIN_SKILL_RATING,
} from '../domain/rating';
import type { PlayerMatchStatLine } from '../domain/statistics';

function stats(overrides: Partial<PlayerMatchStatLine> = {}): PlayerMatchStatLine {
  return {
    player_id: 'P',
    runs_scored: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    strike_rate: null,
    overs_bowled: 0,
    runs_conceded: 0,
    wickets_taken: 0,
    economy_rate: null,
    catches: 0,
    run_outs: 0,
    stumpings: 0,
    ...overrides,
  };
}

describe('computeMatchPerformanceRatingDelta', () => {
  const noContext = { isPlayerOfTheMatch: false, matchWon: false };

  it('a blank match (no runs, wickets, catches) contributes zero', () => {
    expect(computeMatchPerformanceRatingDelta(stats(), noContext)).toBe(0);
  });

  it('runs contribute 1 point each, plus a small strike-rate bonus', () => {
    const delta = computeMatchPerformanceRatingDelta(
      stats({ runs_scored: 50, balls_faced: 50, strike_rate: 100 }),
      noContext,
    );
    // 50 (runs) + round(100 * 0.2) = 50 + 20 = 70
    expect(delta).toBe(70);
  });

  it('wickets contribute 20 points each, reduced by an economy penalty', () => {
    const delta = computeMatchPerformanceRatingDelta(
      stats({ wickets_taken: 2, economy_rate: 5 }),
      noContext,
    );
    // 2*20 - round(5*2) = 40 - 10 = 30
    expect(delta).toBe(30);
  });

  it('catches, run-outs and stumpings each contribute 10 points', () => {
    const delta = computeMatchPerformanceRatingDelta(
      stats({ catches: 1, run_outs: 1, stumpings: 1 }),
      noContext,
    );
    expect(delta).toBe(30);
  });

  it('a match win adds a flat +15 bonus', () => {
    const delta = computeMatchPerformanceRatingDelta(stats(), { ...noContext, matchWon: true });
    expect(delta).toBe(15);
  });

  it('Player of the Match adds a flat +25 bonus', () => {
    const delta = computeMatchPerformanceRatingDelta(stats(), {
      ...noContext,
      isPlayerOfTheMatch: true,
    });
    expect(delta).toBe(25);
  });

  it('an exceptional match is capped at +80 so one game cannot dominate the rating', () => {
    const delta = computeMatchPerformanceRatingDelta(
      stats({
        runs_scored: 150,
        strike_rate: 180,
        wickets_taken: 5,
        catches: 3,
      }),
      { isPlayerOfTheMatch: true, matchWon: true },
    );
    expect(delta).toBe(80);
  });

  it('a very poor bowling economy is floored at -30, never below', () => {
    const delta = computeMatchPerformanceRatingDelta(
      stats({ wickets_taken: 0, economy_rate: 30 }),
      noContext,
    );
    // 0 - round(30*2) = -60, clamped to -30
    expect(delta).toBe(-30);
  });
});

describe('applyRatingDelta / computeSkillRating', () => {
  it('a positive delta raises the rating, a negative delta lowers it', () => {
    expect(applyRatingDelta(500, 40)).toBe(540);
    expect(applyRatingDelta(500, -20)).toBe(480);
  });

  it('clamps at MIN_SKILL_RATING and MAX_SKILL_RATING', () => {
    expect(applyRatingDelta(MIN_SKILL_RATING + 5, -100)).toBe(MIN_SKILL_RATING);
    expect(applyRatingDelta(MAX_SKILL_RATING - 5, 100)).toBe(MAX_SKILL_RATING);
  });

  it('computeSkillRating folds every delta onto the baseline in order', () => {
    expect(computeSkillRating([40, -10, 25])).toBe(BASELINE_SKILL_RATING + 40 - 10 + 25);
  });

  it('an empty event history is exactly the baseline rating', () => {
    expect(computeSkillRating([])).toBe(BASELINE_SKILL_RATING);
  });

  it('is deterministic and order-preserving: the same deltas in the same order always fold to the same value', () => {
    const deltas = [10, -5, 30, -30, 80];
    expect(computeSkillRating(deltas)).toBe(computeSkillRating(deltas));
  });
});

// Backlog B-5: Fair Play Rating, RELIABILITY dimension. Measures how
// evenly balls faced/bowled were shared across a match_team's confirmed
// roster — the "did everyone get an equal chance to play" question from
// the feedback.
describe('computeParticipationFairness', () => {
  it('an exactly equal split is perfectly fair', () => {
    expect(computeParticipationFairness([10, 10, 10, 10])).toBe(1);
  });

  it('no players on the side is treated as fair (nothing to evaluate)', () => {
    expect(computeParticipationFairness([])).toBe(1);
  });

  it('a side that never got any balls at all is treated as fair, not penalized', () => {
    expect(computeParticipationFairness([0, 0, 0])).toBe(1);
  });

  it('one player getting everything and the rest getting nothing is maximally unfair', () => {
    expect(computeParticipationFairness([24, 0, 0, 0])).toBe(0);
  });

  it('a moderate skew lands strictly between 0 and 1', () => {
    const fairness = computeParticipationFairness([15, 5, 4]);
    expect(fairness).toBeGreaterThan(0);
    expect(fairness).toBeLessThan(1);
  });

  it('is symmetric under reordering — only the distribution of counts matters, not which player has which', () => {
    expect(computeParticipationFairness([2, 8, 14])).toBe(computeParticipationFairness([14, 2, 8]));
  });
});

describe('computeFairPlayRatingDelta / applyReliabilityDelta / computeReliabilityScore', () => {
  it('a perfectly fair match causes no change — the score is already at its trusted maximum', () => {
    expect(computeFairPlayRatingDelta(1)).toBe(0);
  });

  it('a maximally unfair match applies the full penalty', () => {
    expect(computeFairPlayRatingDelta(0)).toBe(-20);
  });

  it('a moderately unfair match applies a proportional penalty', () => {
    expect(computeFairPlayRatingDelta(0.5)).toBe(-10);
  });

  it('applyReliabilityDelta clamps at MIN_RELIABILITY_SCORE and MAX_RELIABILITY_SCORE', () => {
    expect(applyReliabilityDelta(MIN_RELIABILITY_SCORE + 5, -100)).toBe(MIN_RELIABILITY_SCORE);
    expect(applyReliabilityDelta(MAX_RELIABILITY_SCORE, 100)).toBe(MAX_RELIABILITY_SCORE);
  });

  it('computeReliabilityScore folds every delta onto the baseline in order', () => {
    expect(computeReliabilityScore([-10, -5])).toBe(BASELINE_RELIABILITY_SCORE - 15);
  });

  it('an empty event history is exactly the baseline (fully trusted)', () => {
    expect(computeReliabilityScore([])).toBe(BASELINE_RELIABILITY_SCORE);
  });
});
