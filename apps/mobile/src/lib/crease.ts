import type { ExtraType, LiveOverBall, LiveScore } from '@bfam/shared-types';

// Who is at the crease after a ball — pure so the rules are unit-testable
// and shared by "after I record a ball" and "I just reopened the scorer"
// (see .claude/MATCH_REVAMP_PLAN.md).

export interface BallLike {
  runs_scored: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  dismissed_player_id?: string | null;
}

export interface Crease {
  strikerId: string | null;
  nonStrikerId: string | null;
}

export function isLegalDelivery(extra: ExtraType): boolean {
  return extra !== 'WIDE' && extra !== 'NO_BALL';
}

// Runs the batters physically ran, which is what decides whether they cross:
// a wide/no-ball always carries an automatic 1 in extra_runs; byes/leg-byes
// are all extra_runs; otherwise it's the runs off the bat.
export function runsRun(ball: BallLike): number {
  switch (ball.extra_type) {
    case 'WIDE':
    case 'NO_BALL':
      return (
        Math.max(ball.extra_runs - 1, 0) + (ball.extra_type === 'NO_BALL' ? ball.runs_scored : 0)
      );
    case 'BYE':
    case 'LEG_BYE':
      return ball.extra_runs;
    default:
      return ball.runs_scored;
  }
}

// "1.3" overs notation -> 9 legal balls.
export function legalBallsFromOvers(overs: number): number {
  const whole = Math.floor(overs);
  return whole * 6 + Math.round((overs - whole) * 10);
}

export function advanceCrease(
  crease: Crease,
  ball: BallLike,
  options: { singleBatter: boolean; overEnded: boolean },
): Crease {
  if (ball.is_wicket) {
    const dismissed = ball.dismissed_player_id ?? crease.strikerId;
    return {
      strikerId: dismissed === crease.strikerId ? null : crease.strikerId,
      nonStrikerId: dismissed === crease.nonStrikerId ? null : crease.nonStrikerId,
    };
  }
  // Single-batter (box cricket): nobody at the other end, nothing to swap.
  if (options.singleBatter) return crease;
  let swap = runsRun(ball) % 2 === 1;
  // Ends change after every over too.
  if (options.overEnded) swap = !swap;
  return swap ? { strikerId: crease.nonStrikerId, nonStrikerId: crease.strikerId } : crease;
}

// Rebuild who is at the crease from the live-score payload after reopening
// the scoring screen mid-innings (the scorer's local picks are gone).
export function restoreCrease(live: LiveScore): Crease {
  const last = live.last_ball;
  const striker = live.current_striker_player_id ?? null;
  if (!last || !striker) return { strikerId: null, nonStrikerId: null };
  const legalBalls = live.innings ? legalBallsFromOvers(Number(live.innings.overs_completed)) : 0;
  return advanceCrease(
    { strikerId: striker, nonStrikerId: live.current_non_striker_player_id ?? null },
    last,
    {
      singleBatter: Boolean(live.no_non_striker),
      overEnded: isLegalDelivery(last.extra_type) && legalBalls > 0 && legalBalls % 6 === 0,
    },
  );
}

// Text inside an over bubble.
export function ballLabel(ball: BallLike): string {
  if (ball.is_wicket) return 'W';
  switch (ball.extra_type) {
    case 'WIDE':
      return ball.extra_runs > 1 ? `wd+${ball.extra_runs - 1}` : 'wd';
    case 'NO_BALL':
      return ball.extra_runs > 1 ? `nb+${ball.extra_runs - 1}` : 'nb';
    case 'BYE':
      return `${ball.extra_runs}b`;
    case 'LEG_BYE':
      return `${ball.extra_runs}lb`;
    default:
      return ball.runs_scored === 0 ? '•' : String(ball.runs_scored);
  }
}

// Bubble fill by outcome, on the dark scoring surface.
export function ballColor(ball: BallLike): string {
  if (ball.is_wicket) return '#D80000';
  if (ball.extra_type !== 'NONE') return '#B7791F';
  if (ball.runs_scored === 6) return '#7B2CBF';
  if (ball.runs_scored === 4) return '#2E9E4F';
  if (ball.runs_scored === 0) return '#3B4451';
  return '#4A5568';
}

export function overRuns(balls: LiveOverBall[]): number {
  return balls.reduce((sum, b) => sum + b.runs_scored + b.extra_runs, 0);
}
