// Automatic match result + Player of the Match (see
// .claude/MATCH_REVAMP_PLAN.md). Pure so it can be unit-tested; the
// scoringService gathers the inputs and does the I/O.

export interface InningsOutcomeInput {
  innings_number: number;
  batting_match_team_id: string;
  total_runs: number;
  total_wickets: number;
}

export interface MatchOutcome {
  result_type: 'WIN' | 'TIE' | 'NO_RESULT';
  winning_match_team_id: string | null;
  // "24 runs" / "3 wickets" — displayed as "won by <margin>".
  winning_margin: string | null;
}

// How many wickets end an innings: with a non-striker the last batter has
// no partner (size - 1); in single-batter mode every batter gets to bat
// (size). Same rule as scoringService.isAllOut.
export function wicketsToEndInnings(teamSize: number, noNonStriker: boolean): number {
  return noNonStriker ? teamSize : teamSize - 1;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function computeMatchOutcome(
  innings: InningsOutcomeInput[],
  options: { battingTeamSize: number | null; noNonStriker: boolean },
): MatchOutcome {
  const ordered = [...innings].sort((a, b) => a.innings_number - b.innings_number);
  if (ordered.length < 2) {
    return { result_type: 'NO_RESULT', winning_match_team_id: null, winning_margin: null };
  }
  const first = ordered[0];
  const second = ordered[1];

  if (second.total_runs > first.total_runs) {
    let margin: string | null = null;
    if (options.battingTeamSize && options.battingTeamSize >= 2) {
      const remaining =
        wicketsToEndInnings(options.battingTeamSize, options.noNonStriker) - second.total_wickets;
      margin = plural(Math.max(remaining, 1), 'wicket');
    }
    return {
      result_type: 'WIN',
      winning_match_team_id: second.batting_match_team_id,
      winning_margin: margin,
    };
  }
  if (second.total_runs < first.total_runs) {
    return {
      result_type: 'WIN',
      winning_match_team_id: first.batting_match_team_id,
      winning_margin: plural(first.total_runs - second.total_runs, 'run'),
    };
  }
  return { result_type: 'TIE', winning_match_team_id: null, winning_margin: null };
}

export const POTM_POINTS_PER_RUN = 1;
export const POTM_POINTS_PER_WICKET = 20;

export interface PotmCandidate {
  player_id: string;
  runs: number;
  wickets: number;
  match_team_id: string | null;
}

// Highest (runs + 20 x wickets). Ties: a member of the winning side first,
// then more wickets, then player_id so the result is deterministic. Returns
// null when nobody scored or took a wicket.
export function pickPlayerOfTheMatch(
  candidates: PotmCandidate[],
  winningMatchTeamId: string | null,
): string | null {
  const points = (c: PotmCandidate) =>
    c.runs * POTM_POINTS_PER_RUN + c.wickets * POTM_POINTS_PER_WICKET;
  const eligible = candidates.filter((c) => points(c) > 0);
  if (eligible.length === 0) return null;
  eligible.sort(
    (a, b) =>
      points(b) - points(a) ||
      Number(b.match_team_id === winningMatchTeamId) -
        Number(a.match_team_id === winningMatchTeamId) ||
      b.wickets - a.wickets ||
      a.player_id.localeCompare(b.player_id),
  );
  return eligible[0].player_id;
}
