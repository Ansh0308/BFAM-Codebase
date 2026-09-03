// Pure Basic Skill Rating calculation (module 2.10, PRD §12.29). The PRD
// specifies *what* the rating considers (runs, strike rate, wickets,
// economy, catches, match result, Player of the Match, overall
// contribution) and gives one example value ("BFAM Rating: 842") but no
// exact formula — this file is BFAM's concrete MVP implementation of that
// spec. It is deliberately simple, bounded, and pure so the number shown
// on the Player Profile screen is always exactly reproducible from the
// match's own statistics, never dependent on ordering or external state.
//
// Deliberately scoped to the SKILL rating_dimension only — RELIABILITY
// (PRD §12.30) shares the same player_rating_events table but is a
// separate P1 module, not implemented here.

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
