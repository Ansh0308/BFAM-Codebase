// Pure Basic Skill Rating calculation (module 2.10, PRD §12.29). The PRD
// specifies *what* the rating considers (runs, strike rate, wickets,
// economy, catches, match result, Player of the Match, overall
// contribution) and gives one example value ("BFAM Rating: 842") but no
// exact formula — this file is BFAM's concrete MVP implementation of that
// spec. It is deliberately simple, bounded, and pure so the number shown
// on the Player Profile screen is always exactly reproducible from the
// match's own statistics, never dependent on ordering or external state.
//
// The SKILL functions below were originally the only rating_dimension
// implemented here; the RELIABILITY/Fair Play functions further down
// (backlog B-5) share the same player_rating_events table and the same
// fold-over-deltas shape, but measure a different thing entirely.

import type { PlayerMatchStatLine } from './statistics';

export const BASELINE_SKILL_RATING = 500;
export const MIN_SKILL_RATING = 0;
export const MAX_SKILL_RATING = 999;

// A single match's swing is capped so one outlier performance (or one bad
// game) can't dominate a player's rating — it should move gradually, over
// many matches, the way PRD §12.29's "overall contribution" implies.
const MIN_MATCH_DELTA = -30;
const MAX_MATCH_DELTA = 80;

export interface MatchPerformanceContext {
  isPlayerOfTheMatch: boolean;
  matchWon: boolean;
}

// Points breakdown, each capturing one PRD §12.29 factor:
//  - batting: 1 point per run, plus a small strike-rate bonus
//  - bowling: 20 points per wicket, minus a small economy penalty
//  - fielding: 10 points per catch/run-out/stumping
//  - match result: +15 for a win
//  - Player of the Match: +25
export function computeMatchPerformanceRatingDelta(
  stats: PlayerMatchStatLine,
  context: MatchPerformanceContext,
): number {
  const battingPoints = stats.runs_scored + Math.round((stats.strike_rate ?? 0) * 0.2);
  const bowlingPoints = stats.wickets_taken * 20 - Math.round((stats.economy_rate ?? 0) * 2);
  const fieldingPoints = (stats.catches + stats.run_outs + stats.stumpings) * 10;
  const resultBonus = context.matchWon ? 15 : 0;
  const potmBonus = context.isPlayerOfTheMatch ? 25 : 0;

  const raw = battingPoints + bowlingPoints + fieldingPoints + resultBonus + potmBonus;
  return Math.max(MIN_MATCH_DELTA, Math.min(MAX_MATCH_DELTA, raw));
}

// The displayed rating is the baseline plus every recorded delta so far,
// clamped to the display range — so it's a pure fold over
// player_rating_events, never a value that has to be separately
// reconciled with its own history.
export function applyRatingDelta(previousRating: number, delta: number): number {
  return Math.max(MIN_SKILL_RATING, Math.min(MAX_SKILL_RATING, previousRating + delta));
}

export function computeSkillRating(ratingDeltas: number[]): number {
  return ratingDeltas.reduce(
    (rating, delta) => applyRatingDelta(rating, delta),
    BASELINE_SKILL_RATING,
  );
}

// Fair Play Rating (backlog B-5, RELIABILITY dimension, PRD §12.30's
// player_rating_events scaffolding) — "did everyone get an equal chance to
// bat and bowl during matches". Unlike SKILL, this isn't a measure of an
// individual's own play: every confirmed player on a match_team shares the
// same fairness delta for a given match, since the fairness of who got to
// play is a property of how the match was run, not of any one player's
// performance.
export const BASELINE_RELIABILITY_SCORE = 100;
export const MIN_RELIABILITY_SCORE = 0;
export const MAX_RELIABILITY_SCORE = 100;

// A perfectly fair match causes no change — the score already starts at
// the trusted maximum, so there's nowhere for a "good" match to move it.
// Only unfair participation (some players barely getting a chance) pulls
// it down, and only gradually, so one lopsided match doesn't tank it.
const MAX_FAIR_PLAY_PENALTY = 20;

// Measures how evenly a fixed pool (e.g. balls faced, or balls bowled) was
// shared across a group of players, as 1 minus the total variation
// distance from a perfectly equal split, normalized against the worst
// possible distribution for that group size (one player getting
// everything, everyone else nothing) rather than a fixed constant — so the
// scale is always meaningful regardless of how many players are on the
// side. 1 = everyone got exactly their equal share (including a share of
// zero, if nobody on this side got any at all — e.g. an abandoned
// innings); 0 = one player got everything and everyone else got nothing.
export function computeParticipationFairness(counts: number[]): number {
  const n = counts.length;
  if (n <= 1) return 1;
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return 1;
  const expectedShare = total / n;
  const deviation = counts.reduce((sum, c) => sum + Math.abs(c - expectedShare), 0);
  const maxPossibleDeviation = (2 * total * (n - 1)) / n;
  const fairness = 1 - deviation / maxPossibleDeviation;
  return Math.max(0, Math.min(1, fairness));
}

export function computeFairPlayRatingDelta(matchFairness: number): number {
  // `|| 0` folds a -0 result (perfectly fair, i.e. no penalty) to a plain
  // 0 — cosmetic, but avoids a surprising -0 leaking into stored deltas.
  return -Math.round((1 - matchFairness) * MAX_FAIR_PLAY_PENALTY) || 0;
}

export function applyReliabilityDelta(previousScore: number, delta: number): number {
  return Math.max(MIN_RELIABILITY_SCORE, Math.min(MAX_RELIABILITY_SCORE, previousScore + delta));
}

export function computeReliabilityScore(ratingDeltas: number[]): number {
  return ratingDeltas.reduce(
    (score, delta) => applyReliabilityDelta(score, delta),
    BASELINE_RELIABILITY_SCORE,
  );
}
