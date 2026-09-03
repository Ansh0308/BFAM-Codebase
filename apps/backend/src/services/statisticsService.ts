import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import {
  computeMatchStatistics,
  type PlayerMatchStatLine,
  type StatEventInput,
} from '../domain/statistics';
import {
  applyRatingDelta,
  BASELINE_SKILL_RATING,
  computeMatchPerformanceRatingDelta,
} from '../domain/rating';
import { MatchNotFoundError, PlayerProfileNotFoundError } from '../domain/errors';
import { sendNotification } from './notificationService';

interface MatchRow {
  match_id: string;
  match_status: string;
}

// Resolves the special "me" route param (Player Statistics / Basic Skill
// Rating are otherwise keyed by player_id, which the mobile client never
// needs to know its own value of) to the caller's actual player_id.
export async function resolveOwnPlayerId(userId: string): Promise<string> {
  const [player] = await sequelize.query<{ player_id: string }>(
    'SELECT player_id FROM players WHERE user_id = :userId',
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  if (!player) throw new PlayerProfileNotFoundError();
  return player.player_id;
}

async function fetchMatchOrThrow(matchId: string): Promise<MatchRow> {
  const [match] = await sequelize.query<MatchRow>(
    'SELECT match_id, match_status FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (!match) throw new MatchNotFoundError(matchId);
  return match;
}

// Match Statistics materialization (PRD §12.21): converts a completed
// match's score_events into lasting player_match_statistics rows.
// Idempotent by construction — it deletes and re-inserts this match's rows
// inside one transaction rather than accumulating, so triggering it twice
// (e.g. finalize retried, or a manual re-materialize) never double-counts.
export async function materializeMatchStatistics(matchId: string) {
  await fetchMatchOrThrow(matchId);

  const events = await sequelize.query<StatEventInput>(
    `SELECT se.striker_player_id, se.bowler_player_id, se.runs_scored, se.extra_type,
            se.extra_runs, se.is_wicket, se.wicket_type, se.fielder_player_id
     FROM score_events se
     JOIN innings i ON i.innings_id = se.innings_id
     WHERE i.match_id = :matchId AND se.is_corrected = FALSE`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );

  const lines = computeMatchStatistics(events);
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    await sequelize
      .getQueryInterface()
      .bulkDelete('player_match_statistics', { match_id: matchId }, { transaction });

    if (lines.size > 0) {
      await sequelize.getQueryInterface().bulkInsert(
        'player_match_statistics',
        Array.from(lines.values()).map((line) => ({
          stat_id: randomUUID(),
          match_id: matchId,
          player_id: line.player_id,
          runs_scored: line.runs_scored,
          balls_faced: line.balls_faced,
          fours: line.fours,
          sixes: line.sixes,
          strike_rate: line.strike_rate,
          overs_bowled: line.overs_bowled,
          runs_conceded: line.runs_conceded,
          wickets_taken: line.wickets_taken,
          economy_rate: line.economy_rate,
          catches: line.catches,
          run_outs: line.run_outs,
          stumpings: line.stumpings,
          computed_at: now,
        })),
        { transaction },
      );
    }
  });

  await materializeRatingEvents(matchId, Array.from(lines.values()));

  return { match_id: matchId, players_materialized: lines.size };
}

// Basic Skill Rating (PRD §12.29): one MATCH_PERFORMANCE/SKILL rating
// event per player per match. Idempotent by checking for an existing event
// for this (player, match) pair first — unlike the stat lines above, rating
// events are an append-only ledger (each one's resulting_value depends on
// everything before it), so re-running skips players who already have an
// event for this match rather than deleting and replacing.
async function materializeRatingEvents(matchId: string, lines: PlayerMatchStatLine[]) {
  if (lines.length === 0) return;

  const [result] = await sequelize.query<{
    winning_match_team_id: string | null;
    player_of_the_match_id: string | null;
  }>(
    'SELECT winning_match_team_id, player_of_the_match_id FROM match_results WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );

  const teamByPlayer = await sequelize.query<{ player_id: string; match_team_id: string | null }>(
    'SELECT player_id, match_team_id FROM match_players WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  const playerTeam = new Map(teamByPlayer.map((p) => [p.player_id, p.match_team_id]));

  // Purely for the RATING_UPDATE notification below — a failure here must
  // never block the rating math/players.skill_rating write above it, so an
  // empty map (meaning: skip notifying) is a safe fallback.
  const userIdByPlayer = await sequelize
    .query<{ player_id: string; user_id: string }>(
      'SELECT player_id, user_id FROM players WHERE player_id IN (:playerIds)',
      { type: QueryTypes.SELECT, replacements: { playerIds: lines.map((l) => l.player_id) } },
    )
    .then((rows) => new Map(rows.map((p) => [p.player_id, p.user_id])))
    .catch(() => new Map<string, string>());

  const alreadyRated = await sequelize.query<{ player_id: string }>(
    `SELECT player_id FROM player_rating_events
     WHERE match_id = :matchId AND event_type = 'MATCH_PERFORMANCE' AND rating_dimension = 'SKILL'`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  const alreadyRatedIds = new Set(alreadyRated.map((r) => r.player_id));

  const now = new Date();
  const newEvents: Record<string, unknown>[] = [];

  for (const line of lines) {
    if (alreadyRatedIds.has(line.player_id)) continue;

    const matchWon = Boolean(
      result?.winning_match_team_id &&
      playerTeam.get(line.player_id) === result.winning_match_team_id,
    );
    const isPlayerOfTheMatch = result?.player_of_the_match_id === line.player_id;
    const delta = computeMatchPerformanceRatingDelta(line, { matchWon, isPlayerOfTheMatch });
    const previousRating = await getPlayerRating(line.player_id);
    const resultingValue = applyRatingDelta(previousRating, delta);

    newEvents.push({
      rating_event_id: randomUUID(),
      player_id: line.player_id,
      match_id: matchId,
      event_type: 'MATCH_PERFORMANCE',
      rating_dimension: 'SKILL',
      rating_delta: delta,
      resulting_value: resultingValue,
      created_by: null,
      created_at: now,
    });

    // players.skill_rating (default 500 — see the Phase 1 migration) is the
    // cached "current value" the Player Profile screen (module 2.2) already
    // reads via GET /profile/me; player_rating_events stays the append-only
    // audit ledger of how it got there.
    await sequelize
      .getQueryInterface()
      .bulkUpdate('players', { skill_rating: resultingValue }, { player_id: line.player_id });

    // RATING_UPDATE (module 2.11, PRD §12.45).
    const userId = userIdByPlayer.get(line.player_id);
    if (userId) {
      await sendNotification({
        userId,
        event: 'RATING_UPDATE',
        params: { newRating: String(resultingValue) },
        relatedEntityType: 'match',
        relatedEntityId: matchId,
      });
    }
  }

  if (newEvents.length > 0) {
    await sequelize.getQueryInterface().bulkInsert('player_rating_events', newEvents);
  }
}

// Basic Skill Rating (PRD §12.29): the resulting_value of the player's most
// recent SKILL-dimension event — equivalently, players.skill_rating, kept
// in sync with it above — or the baseline if they have no event yet.
export async function getPlayerRating(playerId: string): Promise<number> {
  const [latest] = await sequelize.query<{ resulting_value: number }>(
    `SELECT resulting_value FROM player_rating_events
     WHERE player_id = :playerId AND rating_dimension = 'SKILL'
     ORDER BY created_at DESC LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
  return latest ? Number(latest.resulting_value) : BASELINE_SKILL_RATING;
}

export type StatisticsScope = 'lifetime' | 'season';

interface AggregatedStatRow {
  match_id: string;
  scheduled_start_time: Date;
  runs_scored: number;
  balls_faced: number;
  wickets_taken: number;
  overs_bowled: number;
  runs_conceded: number;
  catches: number;
  run_outs: number;
  stumpings: number;
  is_potm: boolean;
  team_won: boolean | null;
}

// Player Statistics (PRD §12.32): lifetime is every completed match on
// record; season is scoped to the current calendar year, since BFAM has no
// separate "season"/tournament entity yet — documented here rather than
// silently assumed by the caller.
function seasonStartDate(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
}

export async function getPlayerStatistics(playerId: string, scope: StatisticsScope) {
  const rows = await sequelize.query<AggregatedStatRow>(
    `SELECT s.match_id, m.scheduled_start_time, s.runs_scored, s.balls_faced, s.wickets_taken,
            s.overs_bowled, s.runs_conceded, s.catches, s.run_outs, s.stumpings,
            (r.player_of_the_match_id = s.player_id) AS is_potm,
            (r.winning_match_team_id IS NOT NULL AND r.winning_match_team_id = mp.match_team_id) AS team_won
     FROM player_match_statistics s
     JOIN matches m ON m.match_id = s.match_id
     LEFT JOIN match_results r ON r.match_id = s.match_id
     LEFT JOIN match_players mp ON mp.match_id = s.match_id AND mp.player_id = s.player_id
     WHERE s.player_id = :playerId AND m.match_status = 'COMPLETED'
     ORDER BY m.scheduled_start_time DESC`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );

  const scoped =
    scope === 'season'
      ? rows.filter((r) => new Date(r.scheduled_start_time) >= seasonStartDate())
      : rows;

  return summarizeStatRows(scoped, scope);
}

// Pure aggregation over already-materialized per-match rows — split out so
// the summing/weighted-average math is independently unit-testable without
// a database.
export function summarizeStatRows(rows: AggregatedStatRow[], scope: StatisticsScope) {
  const matchesPlayed = rows.length;
  const totalRuns = rows.reduce((s, r) => s + r.runs_scored, 0);
  const totalBalls = rows.reduce((s, r) => s + r.balls_faced, 0);
  const totalWickets = rows.reduce((s, r) => s + r.wickets_taken, 0);
  const totalConceded = rows.reduce((s, r) => s + r.runs_conceded, 0);
  const totalLegalBallsBowled = rows.reduce((s, r) => s + oversToLegalBalls(r.overs_bowled), 0);
  const totalCatches = rows.reduce((s, r) => s + r.catches + r.run_outs + r.stumpings, 0);
  const bestScore = rows.reduce((max, r) => Math.max(max, r.runs_scored), 0);
  const potmCount = rows.filter((r) => r.is_potm).length;

  // Current streak (season only, PRD §12.32): consecutive most-recent
  // matches this player's side won, counting back from the latest match
  // until the first non-win or no-result.
  let currentStreak = 0;
  for (const r of rows) {
    if (r.team_won) currentStreak += 1;
    else break;
  }

  return {
    scope,
    matches_played: matchesPlayed,
    runs: totalRuns,
    wickets: totalWickets,
    best_score: matchesPlayed > 0 ? bestScore : null,
    strike_rate: totalBalls > 0 ? round2((totalRuns / totalBalls) * 100) : null,
    economy: totalLegalBallsBowled > 0 ? round2(totalConceded / (totalLegalBallsBowled / 6)) : null,
    catches: totalCatches,
    player_of_the_match_count: potmCount,
    current_streak: scope === 'season' ? currentStreak : undefined,
  };
}

function oversToLegalBalls(oversNotation: number): number {
  const overs = Math.floor(oversNotation);
  const balls = Math.round((oversNotation - overs) * 10);
  return overs * 6 + balls;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
