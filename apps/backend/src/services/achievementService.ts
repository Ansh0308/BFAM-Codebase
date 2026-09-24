import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { creditsBowlerWithWicket } from '../domain/statistics';
import type { WicketType } from '../domain/scoring';
import {
  computeBestWinStreak,
  evaluateAchievements,
  hasHatTrick,
  type AchievementStatus,
  type DeliveryForHatTrick,
} from '../domain/achievements';
import { getXpTotal, computeLevelProgress } from './xpService';

// Long tail — Achievements & Badges (PRD §12.37). Thin DB-fetching layer
// over the pure evaluation in domain/achievements.ts — see that file for
// the scoping decisions behind each badge's threshold.

interface MatchStatRow {
  runs_scored: number;
  sixes: number;
  is_potm: boolean;
  team_won: boolean | null;
  scheduled_start_time: Date;
}

async function fetchPlayerMatchRows(playerId: string): Promise<MatchStatRow[]> {
  return sequelize.query<MatchStatRow>(
    `SELECT s.runs_scored, s.sixes, m.scheduled_start_time,
            (r.player_of_the_match_id = s.player_id) AS is_potm,
            (r.winning_match_team_id IS NOT NULL AND r.winning_match_team_id = mp.match_team_id) AS team_won
     FROM player_match_statistics s
     JOIN matches m ON m.match_id = s.match_id
     LEFT JOIN match_results r ON r.match_id = s.match_id
     LEFT JOIN match_players mp ON mp.match_id = s.match_id AND mp.player_id = s.player_id
     WHERE s.player_id = :playerId AND m.match_status = 'COMPLETED'
     ORDER BY m.scheduled_start_time ASC`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );
}

interface BowlerDeliveryRow {
  match_id: string;
  innings_id: string;
  sequence_number: number;
  is_wicket: boolean;
  wicket_type: string | null;
}

async function fetchBowlerDeliveries(playerId: string): Promise<DeliveryForHatTrick[]> {
  const rows = await sequelize.query<BowlerDeliveryRow>(
    `SELECT i.match_id, se.innings_id, se.sequence_number, se.is_wicket, se.wicket_type
     FROM score_events se
     JOIN innings i ON i.innings_id = se.innings_id
     JOIN matches m ON m.match_id = i.match_id
     WHERE se.bowler_player_id = :playerId AND m.match_status = 'COMPLETED'
     ORDER BY se.innings_id, se.sequence_number ASC`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );

  return rows.map((row) => ({
    matchId: row.match_id,
    inningsId: row.innings_id,
    sequenceNumber: row.sequence_number,
    isWicketForBowler:
      row.is_wicket && creditsBowlerWithWicket(row.wicket_type as WicketType | null),
  }));
}

export async function getPlayerAchievements(playerId: string): Promise<AchievementStatus[]> {
  const [matchRows, bowlerDeliveries, xpTotal, ratingRow] = await Promise.all([
    fetchPlayerMatchRows(playerId),
    fetchBowlerDeliveries(playerId),
    getXpTotal(playerId),
    sequelize.query<{ fair_play_rating: number; reliability_score: number }>(
      'SELECT fair_play_rating, reliability_score FROM players WHERE player_id = :playerId',
      { type: QueryTypes.SELECT, replacements: { playerId } },
    ),
  ]);

  const ratings = ratingRow[0] ?? { fair_play_rating: 100, reliability_score: 100 };

  const bestScore = matchRows.reduce<number | null>(
    (max, r) => (max === null ? r.runs_scored : Math.max(max, r.runs_scored)),
    null,
  );
  const careerSixes = matchRows.reduce((sum, r) => sum + r.sixes, 0);
  const potmCount = matchRows.filter((r) => r.is_potm).length;
  const bestWinStreak = computeBestWinStreak(matchRows.map((r) => ({ teamWon: r.team_won })));

  return evaluateAchievements({
    matchesPlayed: matchRows.length,
    bestScore,
    careerSixes,
    potmCount,
    bestWinStreak,
    hasHatTrick: hasHatTrick(bowlerDeliveries),
    fairPlayRating: Number(ratings.fair_play_rating),
    reliabilityScore: Number(ratings.reliability_score),
    isLegendLevel: computeLevelProgress(xpTotal).level === 'Legend',
  });
}
