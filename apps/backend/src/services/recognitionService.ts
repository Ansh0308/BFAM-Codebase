import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Long tail — Special Recognition (PRD §12.39). Scoping decisions (no
// founder available — see RESUME_STATE.md): only the monthly awards that
// can be computed from data that exists today, on the fly with no new
// table (a month's awards are a pure function of that month's completed
// matches, so nothing needs persisting):
// - Batting Star: most runs in the month.
// - Bowling Star: most wickets in the month.
// - Player of the Month: highest (runs + 20 × wickets). The 20× weight is
//   a judgement call (a wicket is worth roughly a 20-run partnership
//   contribution in T20-length games); there is no MVP formula in the PRD.
// - Sportsman of the Month: highest *current* fair_play_rating among
//   players who played that month — fair-play history isn't stored per
//   month, so this is a snapshot, not a historical rating.
// Left out: Tournament Awards (no tournament entity — see the Tournaments
// & Leagues long-tail item) and a persisted Hall of Fame.
export const WICKET_WEIGHT = 20;

export interface MonthlyPlayerRow {
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  runs: number;
  wickets: number;
  matches: number;
  fair_play_rating: number;
}

export interface Award {
  award: 'BATTING_STAR' | 'BOWLING_STAR' | 'PLAYER_OF_THE_MONTH' | 'SPORTSMAN_OF_THE_MONTH';
  player_id: string;
  bfam_id: string;
  full_name: string | null;
  value: number;
}

function best(
  rows: MonthlyPlayerRow[],
  award: Award['award'],
  score: (r: MonthlyPlayerRow) => number,
  minScore: number,
): Award | null {
  // Ties go to the player with more matches, then the lower BFAM ID, so
  // the result is deterministic.
  const sorted = [...rows].sort(
    (a, b) => score(b) - score(a) || b.matches - a.matches || a.bfam_id.localeCompare(b.bfam_id),
  );
  const top = sorted[0];
  if (!top || score(top) < minScore) return null;
  return {
    award,
    player_id: top.player_id,
    bfam_id: top.bfam_id,
    full_name: top.full_name,
    value: score(top),
  };
}

// Pure so the tie-break / threshold rules are unit-testable. A zero-run or
// zero-wicket "star" isn't an award, hence the minimum of 1.
export function pickMonthlyAwards(rows: MonthlyPlayerRow[]): Award[] {
  return [
    best(rows, 'BATTING_STAR', (r) => r.runs, 1),
    best(rows, 'BOWLING_STAR', (r) => r.wickets, 1),
    best(rows, 'PLAYER_OF_THE_MONTH', (r) => r.runs + WICKET_WEIGHT * r.wickets, 1),
    best(rows, 'SPORTSMAN_OF_THE_MONTH', (r) => r.fair_play_rating, 0),
  ].filter((a): a is Award => a !== null);
}

// "YYYY-MM" → [start, end) in UTC, or null when malformed.
export function monthRange(month: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const idx = Number(m[2]) - 1;
  return { start: new Date(Date.UTC(year, idx, 1)), end: new Date(Date.UTC(year, idx + 1, 1)) };
}

export async function getMonthlyRecognition(month: string): Promise<Award[]> {
  const range = monthRange(month);
  if (!range) throw new Error(`Invalid month ${month}`);
  const rows = await sequelize.query<MonthlyPlayerRow>(
    `SELECT s.player_id, p.bfam_id, p.full_name,
            SUM(s.runs_scored) AS runs, SUM(s.wickets_taken) AS wickets,
            COUNT(*) AS matches, p.fair_play_rating
     FROM player_match_statistics s
     JOIN matches m ON m.match_id = s.match_id
     JOIN players p ON p.player_id = s.player_id
     WHERE m.match_status = 'COMPLETED'
       AND m.scheduled_start_time >= :start AND m.scheduled_start_time < :end
     GROUP BY s.player_id, p.bfam_id, p.full_name, p.fair_play_rating`,
    { type: QueryTypes.SELECT, replacements: { start: range.start, end: range.end } },
  );
  // MySQL returns SUM/COUNT as strings/decimals.
  return pickMonthlyAwards(
    rows.map((r) => ({
      ...r,
      runs: Number(r.runs),
      wickets: Number(r.wickets),
      matches: Number(r.matches),
      fair_play_rating: Number(r.fair_play_rating),
    })),
  );
}
