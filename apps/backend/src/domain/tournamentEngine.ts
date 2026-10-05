// Tournament maths (no database): fixture generation, knockout byes and
// advancement, and the league points table with net run rate. Kept pure so the
// rules are easy to test and the service layer only has to persist the output.

export type FixtureStage = 'LEAGUE' | 'KNOCKOUT';

export interface FixtureSeed {
  stage: FixtureStage;
  round_number: number;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  /** Knockout only: which later fixture the winner goes to, and in which slot. */
  next_match_number: number | null;
  next_slot: 'A' | 'B' | null;
}

// ---- League: round robin (circle method) -----------------------------------

// Every team plays every other team once (twice when `doubleRound`). With an
// odd number of teams one team rests each round — that rest is not a fixture.
export function generateRoundRobin(teamIds: string[], doubleRound = false): FixtureSeed[] {
  if (teamIds.length < 2) return [];
  const teams: (string | null)[] = [...teamIds];
  if (teams.length % 2 === 1) teams.push(null); // bye placeholder
  const n = teams.length;
  const rounds = n - 1;
  const out: FixtureSeed[] = [];
  let matchNumber = 1;

  const ring = [...teams];
  const firstLeg: [string, string][][] = [];
  for (let r = 0; r < rounds; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a && b) {
        // Alternate home/away so no team is always "A".
        pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    firstLeg.push(pairs);
    // rotate everything except the first element
    ring.splice(1, 0, ring.pop() as string | null);
  }

  const legs = doubleRound ? 2 : 1;
  for (let leg = 0; leg < legs; leg++) {
    firstLeg.forEach((pairs, r) => {
      for (const [a, b] of pairs) {
        out.push({
          stage: 'LEAGUE',
          round_number: leg * rounds + r + 1,
          match_number: matchNumber++,
          team_a_id: leg === 0 ? a : b,
          team_b_id: leg === 0 ? b : a,
          next_match_number: null,
          next_slot: null,
        });
      }
    });
  }
  return out;
}

// ---- Knockout bracket -------------------------------------------------------

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard seeded bracket order for a power-of-two field: 1 v N, 2 v N-1 ...
// arranged so seeds 1 and 2 can only meet in the final.
function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((s) => [s, total - s]);
  }
  return order;
}

// `teamIds` must be in seed order (best first). Fields that are not a power of
// two give byes to the top seeds; a bye is a first-round fixture with an empty
// slot, which the caller completes automatically (see `isBye`).
export function generateKnockout(teamIds: string[], startMatchNumber = 1): FixtureSeed[] {
  if (teamIds.length < 2) return [];
  const size = nextPowerOfTwo(teamIds.length);
  const order = bracketOrder(size);
  const rounds = Math.log2(size);
  const out: FixtureSeed[] = [];

  // matches per round: size/2, size/4, ... 1
  const firstNumberOfRound: number[] = [];
  let n = startMatchNumber;
  for (let r = 1; r <= rounds; r++) {
    firstNumberOfRound[r] = n;
    n += size / Math.pow(2, r);
  }

  for (let r = 1; r <= rounds; r++) {
    const count = size / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      const seedA = r === 1 ? order[i * 2] : null;
      const seedB = r === 1 ? order[i * 2 + 1] : null;
      const isFinal = r === rounds;
      out.push({
        stage: 'KNOCKOUT',
        round_number: r,
        match_number: firstNumberOfRound[r] + i,
        team_a_id: seedA ? (teamIds[seedA - 1] ?? null) : null,
        team_b_id: seedB ? (teamIds[seedB - 1] ?? null) : null,
        next_match_number: isFinal ? null : firstNumberOfRound[r + 1] + Math.floor(i / 2),
        next_slot: isFinal ? null : i % 2 === 0 ? 'A' : 'B',
      });
    }
  }
  return out;
}

/** A first-round fixture where one side has no opponent. */
export function isBye(f: Pick<FixtureSeed, 'round_number' | 'team_a_id' | 'team_b_id' | 'stage'>) {
  return (
    f.stage === 'KNOCKOUT' &&
    f.round_number === 1 &&
    (!f.team_a_id || !f.team_b_id) &&
    !!(f.team_a_id || f.team_b_id)
  );
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-final';
  if (fromEnd === 2) return 'Quarter-final';
  return `Round ${round}`;
}

// ---- Points table -----------------------------------------------------------

export const POINTS_WIN = 2;
export const POINTS_TIE = 1;
export const POINTS_NO_RESULT = 1;

export interface ResultFixture {
  team_a_id: string | null;
  team_b_id: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | string;
  result_type: 'WIN' | 'TIE' | 'NO_RESULT' | null;
  winner_team_id: string | null;
  team_a_runs: number | null;
  team_a_balls: number | null;
  team_b_runs: number | null;
  team_b_balls: number | null;
}

export interface PointsRow {
  team_id: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  runs_for: number;
  balls_for: number;
  runs_against: number;
  balls_against: number;
  nrr: number;
}

/** "5.3" (5 overs 3 balls) -> 33 balls. */
export function ballsFromOvers(overs: number): number {
  const whole = Math.floor(overs);
  return whole * 6 + Math.round((overs - whole) * 10);
}

/** 33 balls -> 5.3 */
export function oversFromBalls(balls: number): number {
  return Math.floor(balls / 6) + (balls % 6) / 10;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function computePointsTable(
  teams: { team_id: string; name: string }[],
  fixtures: ResultFixture[],
): (PointsRow & { name: string; rank: number })[] {
  const rows = new Map<string, PointsRow>(
    teams.map((t) => [
      t.team_id,
      {
        team_id: t.team_id,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        no_result: 0,
        points: 0,
        runs_for: 0,
        balls_for: 0,
        runs_against: 0,
        balls_against: 0,
        nrr: 0,
      },
    ]),
  );

  for (const f of fixtures) {
    if (f.status !== 'COMPLETED' || !f.team_a_id || !f.team_b_id || !f.result_type) continue;
    const a = rows.get(f.team_a_id);
    const b = rows.get(f.team_b_id);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;

    if (f.result_type === 'WIN' && f.winner_team_id) {
      const win = f.winner_team_id === f.team_a_id ? a : b;
      const loss = win === a ? b : a;
      win.won += 1;
      win.points += POINTS_WIN;
      loss.lost += 1;
    } else if (f.result_type === 'TIE') {
      a.tied += 1;
      b.tied += 1;
      a.points += POINTS_TIE;
      b.points += POINTS_TIE;
    } else {
      a.no_result += 1;
      b.no_result += 1;
      a.points += POINTS_NO_RESULT;
      b.points += POINTS_NO_RESULT;
    }

    // Run rate only counts matches that produced a result.
    if (f.result_type !== 'NO_RESULT') {
      a.runs_for += f.team_a_runs ?? 0;
      a.balls_for += f.team_a_balls ?? 0;
      a.runs_against += f.team_b_runs ?? 0;
      a.balls_against += f.team_b_balls ?? 0;
      b.runs_for += f.team_b_runs ?? 0;
      b.balls_for += f.team_b_balls ?? 0;
      b.runs_against += f.team_a_runs ?? 0;
      b.balls_against += f.team_a_balls ?? 0;
    }
  }

  for (const r of rows.values()) {
    const forRate = r.balls_for > 0 ? (r.runs_for / r.balls_for) * 6 : 0;
    const againstRate = r.balls_against > 0 ? (r.runs_against / r.balls_against) * 6 : 0;
    r.nrr = round3(forRate - againstRate);
  }

  const nameOf = new Map(teams.map((t) => [t.team_id, t.name]));
  return [...rows.values()]
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.won - x.won ||
        y.nrr - x.nrr ||
        (nameOf.get(x.team_id) ?? '').localeCompare(nameOf.get(y.team_id) ?? ''),
    )
    .map((r, i) => ({ ...r, name: nameOf.get(r.team_id) ?? '', rank: i + 1 }));
}

/** How many teams go through from the league to the knockout. */
export function knockoutQualifiers(teamCount: number): number {
  if (teamCount >= 8) return 4;
  if (teamCount >= 4) return 4;
  return 2;
}
