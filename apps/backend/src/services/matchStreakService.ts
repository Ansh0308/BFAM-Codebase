import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { computeMatchStreaks, type MatchStreaks } from '../domain/matchStreaks';

// Long tail — Match Streaks (PRD §12.38). Thin DB-fetching layer over the
// pure week/streak math in domain/matchStreaks.ts.
export async function getPlayerMatchStreaks(playerId: string): Promise<MatchStreaks> {
  const rows = await sequelize.query<{ scheduled_start_time: Date }>(
    `SELECT DISTINCT m.scheduled_start_time
     FROM player_match_statistics s
     JOIN matches m ON m.match_id = s.match_id
     WHERE s.player_id = :playerId AND m.match_status = 'COMPLETED'`,
    { type: QueryTypes.SELECT, replacements: { playerId } },
  );

  return computeMatchStreaks(rows.map((r) => new Date(r.scheduled_start_time)));
}
