// Long tail — Achievements & Badges (PRD §12.37). Pure evaluation logic,
// deliberately dependency-free (no DB) so it's unit-testable directly —
// same split as statistics.ts (pure) / statisticsService.ts (DB wrapper).
//
// PRD §12.37 names nine example badges but specifies no unlock criteria
// for any of them. Scoping decision (no founder available — see
// RESUME_STATE.md): documented MVP thresholds below, computed from data
// that already exists (player_match_statistics, players.fair_play_rating/
// reliability_score, the XP/Level system, and score_events for the one
// badge that genuinely needs ball-by-ball data). Every threshold is a
// constant here, not hidden in the query, so it's a one-line change later
// if product wants different numbers — nothing about a player's earned
// badges is stored, so changing a threshold instantly re-evaluates
// everyone consistently, same reasoning as xpService.ts's level table.

export type AchievementId =
  | 'FIRST_MATCH'
  | 'CENTURY_CLUB'
  | 'SIX_MACHINE'
  | 'HAT_TRICK_HERO'
  | 'MATCH_STREAK'
  | 'BFAM_LEGEND'
  | 'FAIR_PLAY_CHAMPION'
  | 'RELIABLE_PLAYER'
  | 'TOP_PERFORMER';

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: 'FIRST_MATCH', name: 'First Match', description: 'Played your first completed match.' },
  { id: 'CENTURY_CLUB', name: 'Century Club', description: 'Scored 100+ runs in a single match.' },
  { id: 'SIX_MACHINE', name: 'Six Machine', description: 'Hit 25 or more career sixes.' },
  {
    id: 'HAT_TRICK_HERO',
    name: 'Hat-Trick Hero',
    description: 'Took wickets on 3 consecutive deliveries you bowled.',
  },
  {
    id: 'MATCH_STREAK',
    name: 'Match Streak',
    description: 'Won 3 or more matches in a row.',
  },
  { id: 'BFAM_LEGEND', name: 'BFAM Legend', description: 'Reached the Legend XP level.' },
  {
    id: 'FAIR_PLAY_CHAMPION',
    name: 'Fair Play Champion',
    description: 'Maintained a Fair Play rating of 95 or above.',
  },
  {
    id: 'RELIABLE_PLAYER',
    name: 'Reliable Player',
    description: 'Maintained a Reliability score of 95 or above.',
  },
  {
    id: 'TOP_PERFORMER',
    name: 'Top Performer',
    description: 'Won Player of the Match at least once.',
  },
];

export const MIN_CENTURY_RUNS = 100;
export const MIN_CAREER_SIXES_FOR_SIX_MACHINE = 25;
export const MIN_WIN_STREAK_FOR_MATCH_STREAK = 3;
export const MIN_FAIR_PLAY_RATING_FOR_CHAMPION = 95;
export const MIN_RELIABILITY_SCORE_FOR_RELIABLE_PLAYER = 95;

export interface AchievementInput {
  matchesPlayed: number;
  bestScore: number | null;
  careerSixes: number;
  potmCount: number;
  bestWinStreak: number;
  hasHatTrick: boolean;
  fairPlayRating: number;
  reliabilityScore: number;
  isLegendLevel: boolean;
}

export interface AchievementStatus extends AchievementDefinition {
  earned: boolean;
}

export function evaluateAchievements(input: AchievementInput): AchievementStatus[] {
  const earnedMap: Record<AchievementId, boolean> = {
    FIRST_MATCH: input.matchesPlayed >= 1,
    CENTURY_CLUB: (input.bestScore ?? 0) >= MIN_CENTURY_RUNS,
    SIX_MACHINE: input.careerSixes >= MIN_CAREER_SIXES_FOR_SIX_MACHINE,
    HAT_TRICK_HERO: input.hasHatTrick,
    MATCH_STREAK: input.bestWinStreak >= MIN_WIN_STREAK_FOR_MATCH_STREAK,
    BFAM_LEGEND: input.isLegendLevel,
    FAIR_PLAY_CHAMPION: input.fairPlayRating >= MIN_FAIR_PLAY_RATING_FOR_CHAMPION,
    RELIABLE_PLAYER: input.reliabilityScore >= MIN_RELIABILITY_SCORE_FOR_RELIABLE_PLAYER,
    TOP_PERFORMER: input.potmCount >= 1,
  };

  return ACHIEVEMENT_DEFINITIONS.map((def) => ({ ...def, earned: earnedMap[def.id] }));
}

// Longest run of consecutive wins, in chronological order — NOT "current
// streak from the most recent match" (that's statisticsService.ts's
// summarizeStatRows, season-scoped only); this is lifetime best, which is
// what the Match Streak achievement and PRD §12.38's "best streak" both
// actually need. A `null` team_won (no-result/bye) breaks the streak, same
// as a loss — it's not a win.
export function computeBestWinStreak(matchesChronological: { teamWon: boolean | null }[]): number {
  let best = 0;
  let current = 0;
  for (const m of matchesChronological) {
    if (m.teamWon) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

// Hat-trick detection (PRD's "Hat-Trick Hero"): 3 wickets credited to this
// bowler on 3 immediately consecutive deliveries HE bowled. Scoping
// decision: this checks consecutiveness within the bowler's own filtered
// list of deliveries (ordered by innings then sequence_number), not
// whether those deliveries were also literally back-to-back balls in the
// innings overall — a bowler who takes a wicket on the last ball of his
// over and the first ball of his next over (skipping other bowlers'
// overs in between) still counts, matching the real cricket rule that a
// hat-trick can span overs. What it does NOT model: two wickets in one
// match followed by the third in a LATER match — real cricket allows this
// (a hat-trick can span innings/matches for the same bowler in the same
// tournament); BFAM has no match-series/tournament concept to scope that
// to, so this is deliberately per-match only.
export interface DeliveryForHatTrick {
  matchId: string;
  inningsId: string;
  sequenceNumber: number;
  isWicketForBowler: boolean;
}

export function hasHatTrick(deliveries: DeliveryForHatTrick[]): boolean {
  const byMatch = new Map<string, DeliveryForHatTrick[]>();
  for (const d of deliveries) {
    const list = byMatch.get(d.matchId) ?? [];
    list.push(d);
    byMatch.set(d.matchId, list);
  }

  for (const list of byMatch.values()) {
    const sorted = [...list].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    let consecutive = 0;
    for (const d of sorted) {
      consecutive = d.isWicketForBowler ? consecutive + 1 : 0;
      if (consecutive >= 3) return true;
    }
  }
  return false;
}
