// Pure score_events -> player_match_statistics calculation logic (module
// 2.10, PRD §12.21). Deliberately has no DB/transaction dependency so it
// can be unit-tested directly — statisticsService.ts is the thin
// transactional wrapper that reads events and upserts the result.

import {
  isLegalDelivery,
  legalBallsToOversNotation,
  runsConcededForBall,
  totalRunsForBall,
  type ExtraType,
  type WicketType,
} from './scoring';

export interface StatEventInput {
  striker_player_id: string;
  bowler_player_id: string;
  runs_scored: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: WicketType | null;
  fielder_player_id: string | null;
}

export interface PlayerMatchStatLine {
  player_id: string;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  strike_rate: number | null;
  overs_bowled: number;
  runs_conceded: number;
  wickets_taken: number;
  economy_rate: number | null;
  catches: number;
  run_outs: number;
  stumpings: number;
}

function emptyLine(playerId: string): PlayerMatchStatLine {
  return {
    player_id: playerId,
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
  };
}

// A run-out isn't credited to the bowler (mirrors scoringService's
// getScorecard rule) — every other wicket type is.
function creditsBowlerWithWicket(wicketType: WicketType | null): boolean {
  return wicketType !== null && wicketType !== 'RUN_OUT';
}

// Aggregates one match's ball-by-ball ledger into a per-player stat line —
// batting (runs/balls/boundaries/strike rate), bowling (overs/runs/wickets/
// economy), and fielding (catches/run-outs/stumpings, credited to
// fielder_player_id). Deterministic and side-effect free: the same event
// list always produces the same lines, which is what makes materialization
// safe to re-run.
export function computeMatchStatistics(events: StatEventInput[]): Map<string, PlayerMatchStatLine> {
  const lines = new Map<string, PlayerMatchStatLine>();
  const legalBallsBowled = new Map<string, number>();

  function line(playerId: string): PlayerMatchStatLine {
    let existing = lines.get(playerId);
    if (!existing) {
      existing = emptyLine(playerId);
      lines.set(playerId, existing);
    }
    return existing;
  }

  for (const e of events) {
    const bat = line(e.striker_player_id);
    bat.runs_scored += e.runs_scored;
    if (e.extra_type !== 'WIDE') bat.balls_faced += 1; // wides don't count as a ball faced
    if (e.runs_scored === 4 && e.extra_type === 'NONE') bat.fours += 1;
    if (e.runs_scored === 6 && e.extra_type === 'NONE') bat.sixes += 1;

    const bowl = line(e.bowler_player_id);
    bowl.runs_conceded += runsConcededForBall(e);
    if (isLegalDelivery(e.extra_type)) {
      legalBallsBowled.set(e.bowler_player_id, (legalBallsBowled.get(e.bowler_player_id) ?? 0) + 1);
    }
    if (e.is_wicket && creditsBowlerWithWicket(e.wicket_type)) bowl.wickets_taken += 1;

    if (e.is_wicket && e.fielder_player_id) {
      const fielder = line(e.fielder_player_id);
      if (e.wicket_type === 'CAUGHT') fielder.catches += 1;
      else if (e.wicket_type === 'RUN_OUT') fielder.run_outs += 1;
      else if (e.wicket_type === 'STUMPED') fielder.stumpings += 1;
    }
  }

  for (const [playerId, legalBalls] of legalBallsBowled) {
    const bowl = line(playerId);
    bowl.overs_bowled = legalBallsToOversNotation(legalBalls);
    bowl.economy_rate = legalBalls > 0 ? round2(bowl.runs_conceded / (legalBalls / 6)) : null;
  }

  for (const bat of lines.values()) {
    bat.strike_rate =
      bat.balls_faced > 0 ? round2((bat.runs_scored / bat.balls_faced) * 100) : null;
  }

  return lines;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-exported purely so callers (and tests) computing totalRunsForBall
// alongside this module don't need a second import from ../domain/scoring.
export { totalRunsForBall };
