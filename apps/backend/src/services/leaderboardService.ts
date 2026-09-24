import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { oversNotationToLegalBalls } from '../domain/scoring';

// Backlog "long tail" — Rankings & Leaderboards (PRD §12.33, P1). Nothing
// resembling a cross-player ranking exists anywhere in the app yet, even
// though every input it needs already does: player_match_statistics
// (per-match runs/wickets/sixes/balls/overs, materialized by module
// 2.10's materializeMatchStatistics) and players.skill_rating/
// reliability_score/fair_play_rating (kept current by statisticsService's
// rating-event pipeline).
//
// Scoping decision (no founder available — see RESUME_STATE.md): PRD
// §12.33 lists many dimensions ("top players, best batsmen/bowlers/all-
// rounders... MVP... Fair Play... Reliability... Tournament leaderboard").
// This first cut covers the ones with a real, unambiguous ranking metric
// from data that exists today: most runs/wickets/sixes, best strike rate/
// economy, and the three rating dimensions. Left out: "MVP" (no defined
// scoring formula anywhere), "all-rounder" ranking (would need a combined
// batting+bowling formula nobody has specified), and "Tournament
// leaderboard" (no tournament entity exists — see the long-tail list's
// separate Tournaments & Leagues item).
//
// Rate-based categories (strike rate, economy) need a qualifying minimum
// — otherwise a player's single 6-run over of no-balls tops the economy
// leaderboard forever. Chosen thresholds (documented, not hidden): 30
// balls faced for strike rate, 36 legal balls (6 overs) bowled for
// economy — small enough that an active player qualifies quickly, large
// enough to rule out a one-match fluke.
export const STAT_LEADERBOARD_CATEGORIES = [
  'MOST_RUNS',
  'MOST_WICKETS',
  'MOST_SIXES',
  'BEST_STRIKE_RATE',
  'BEST_ECONOMY',
] as const;
export const RATING_LEADERBOARD_CATEGORIES = [
  'HIGHEST_SKILL_RATING',
  'FAIR_PLAY',
  'RELIABILITY',
] as const;
export const LEADERBOARD_CATEGORIES = [
  ...STAT_LEADERBOARD_CATEGORIES,
  ...RATING_LEADERBOARD_CATEGORIES,
] as const;
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

const MIN_BALLS_FACED_FOR_STRIKE_RATE = 30;
const MIN_LEGAL_BALLS_BOWLED_FOR_ECONOMY = 36;
const DEFAULT_LIMIT = 20;

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  value: number;
}

interface StatRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  runs_scored: number;
  balls_faced: number;
  sixes: number;
  wickets_taken: number;
  overs_bowled: number;
  runs_conceded: number;
}

interface PlayerAggregate {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  runs: number;
  wickets: number;
  sixes: number;
  ballsFaced: number;
  legalBallsBowled: number;
  runsConceded: number;
}

async function fetchStatRows(): Promise<StatRow[]> {
  return sequelize.query<StatRow>(
    `SELECT s.player_id, p.bfam_id, p.full_name, s.runs_scored, s.balls_faced, s.sixes,
            s.wickets_taken, s.overs_bowled, s.runs_conceded
     FROM player_match_statistics s
     JOIN matches m ON m.match_id = s.match_id
     JOIN players p ON p.player_id = s.player_id
     WHERE m.match_status = 'COMPLETED'`,
    { type: QueryTypes.SELECT },
  );
}

// Aggregates raw per-match rows into one row per player — split out from
// getStatLeaderboard so the grouping/ranking math is unit-testable without
// a database, same reasoning as statisticsService.ts's summarizeStatRows.
export function aggregateByPlayer(rows: StatRow[]): PlayerAggregate[] {
  const byPlayer = new Map<string, PlayerAggregate>();
  for (const row of rows) {
    const existing = byPlayer.get(row.player_id) ?? {
      player_id: row.player_id,
      bfam_id: row.bfam_id,
      full_name: row.full_name,
      runs: 0,
      wickets: 0,
      sixes: 0,
      ballsFaced: 0,
      legalBallsBowled: 0,
      runsConceded: 0,
    };
    existing.runs += row.runs_scored;
    existing.wickets += row.wickets_taken;
    existing.sixes += row.sixes;
    existing.ballsFaced += row.balls_faced;
    existing.legalBallsBowled += oversNotationToLegalBalls(row.overs_bowled);
    existing.runsConceded += row.runs_conceded;
    byPlayer.set(row.player_id, existing);
  }
  return [...byPlayer.values()];
}

function rank(
  aggregates: PlayerAggregate[],
  value: (a: PlayerAggregate) => number | null,
  limit: number,
): LeaderboardEntry[] {
  return aggregates
    .map((a) => ({ a, v: value(a) }))
    .filter((r): r is { a: PlayerAggregate; v: number } => r.v !== null)
    .sort((x, y) => y.v - x.v)
    .slice(0, limit)
    .map(({ a, v }, index) => ({
      rank: index + 1,
      player_id: a.player_id,
      bfam_id: a.bfam_id,
      full_name: a.full_name,
      value: Math.round(v * 100) / 100,
    }));
}

async function getStatLeaderboard(
  category: (typeof STAT_LEADERBOARD_CATEGORIES)[number],
  limit: number,
): Promise<LeaderboardEntry[]> {
  const aggregates = aggregateByPlayer(await fetchStatRows());

  switch (category) {
    case 'MOST_RUNS':
      return rank(aggregates, (a) => a.runs, limit);
    case 'MOST_WICKETS':
      return rank(aggregates, (a) => a.wickets, limit);
    case 'MOST_SIXES':
      return rank(aggregates, (a) => a.sixes, limit);
    case 'BEST_STRIKE_RATE':
      return rank(
        aggregates,
        (a) =>
          a.ballsFaced >= MIN_BALLS_FACED_FOR_STRIKE_RATE ? (a.runs / a.ballsFaced) * 100 : null,
        limit,
      );
    case 'BEST_ECONOMY':
      // Economy is runs-per-over — lower is better, so rank by its
      // negation (the shared `rank` helper always sorts descending).
      return rank(
        aggregates,
        (a) =>
          a.legalBallsBowled >= MIN_LEGAL_BALLS_BOWLED_FOR_ECONOMY
            ? -((a.runsConceded / a.legalBallsBowled) * 6)
            : null,
        limit,
      ).map((entry) => ({ ...entry, value: Math.round(-entry.value * 100) / 100 }));
  }
}

async function getRatingLeaderboard(
  category: (typeof RATING_LEADERBOARD_CATEGORIES)[number],
  limit: number,
): Promise<LeaderboardEntry[]> {
  const column =
    category === 'HIGHEST_SKILL_RATING'
      ? 'skill_rating'
      : category === 'FAIR_PLAY'
        ? 'fair_play_rating'
        : 'reliability_score';

  const rows = await sequelize.query<{
    player_id: string;
    bfam_id: string;
    full_name: string | null;
    value: number;
  }>(
    `SELECT player_id, bfam_id, full_name, ${column} AS value
     FROM players
     ORDER BY ${column} DESC
     LIMIT :limit`,
    { type: QueryTypes.SELECT, replacements: { limit } },
  );

  return rows.map((row, index) => ({
    rank: index + 1,
    player_id: row.player_id,
    bfam_id: row.bfam_id,
    full_name: row.full_name,
    value: Number(row.value),
  }));
}

export async function getLeaderboard(
  category: LeaderboardCategory,
  limit: number = DEFAULT_LIMIT,
): Promise<LeaderboardEntry[]> {
  if ((STAT_LEADERBOARD_CATEGORIES as readonly string[]).includes(category)) {
    return getStatLeaderboard(category as (typeof STAT_LEADERBOARD_CATEGORIES)[number], limit);
  }
  return getRatingLeaderboard(category as (typeof RATING_LEADERBOARD_CATEGORIES)[number], limit);
}
