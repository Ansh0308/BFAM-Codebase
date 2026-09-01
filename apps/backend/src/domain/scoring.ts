// Pure ball-event -> score/innings-total calculation logic (module 2.8,
// PRD §12.18). Deliberately has no DB/transaction/Express dependency so it
// can be unit-tested directly — scoringService.ts is the thin
// transactional wrapper around this.

export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';
export type WicketType =
  'BOWLED' | 'CAUGHT' | 'RUN_OUT' | 'STUMPED' | 'LBW' | 'HIT_WICKET' | 'RETIRED';
export type AudioTrigger =
  | 'SIX'
  | 'FOUR'
  | 'WICKET'
  | 'FIFTY'
  | 'CENTURY'
  | 'HAT_TRICK'
  | 'MATCH_WON'
  | 'TOSS'
  | 'COUNTDOWN_START'
  | 'NONE';

export interface BallInput {
  runs_scored: number; // runs off the bat, credited to the striker
  extra_type: ExtraType;
  extra_runs: number; // wide/no-ball/bye/leg-bye runs, credited to the team only
  is_wicket: boolean;
  wicket_type: WicketType | null;
}

export interface InningsTotals {
  total_runs: number;
  total_wickets: number;
  /** Legal deliveries bowled so far (6 = one over) — not the DB's X.Y notation. */
  legal_balls: number;
}

// A WIDE or NO_BALL doesn't count as a legal delivery (the over doesn't
// progress); every other delivery does, including BYE/LEG_BYE.
export function isLegalDelivery(extraType: ExtraType): boolean {
  return extraType !== 'WIDE' && extraType !== 'NO_BALL';
}

export function totalRunsForBall(ball: Pick<BallInput, 'runs_scored' | 'extra_runs'>): number {
  return ball.runs_scored + ball.extra_runs;
}

// Runs that count against the bowler's figures — everything except
// byes/leg-byes, which are the fielding side's fault, not the bowler's.
export function runsConcededForBall(
  ball: Pick<BallInput, 'runs_scored' | 'extra_type' | 'extra_runs'>,
): number {
  if (ball.extra_type === 'BYE' || ball.extra_type === 'LEG_BYE') return ball.runs_scored;
  return ball.runs_scored + ball.extra_runs;
}

export function applyBall(totals: InningsTotals, ball: BallInput): InningsTotals {
  return {
    total_runs: totals.total_runs + totalRunsForBall(ball),
    total_wickets: totals.total_wickets + (ball.is_wicket ? 1 : 0),
    legal_balls: totals.legal_balls + (isLegalDelivery(ball.extra_type) ? 1 : 0),
  };
}

// Undo is the exact inverse of applyBall — subtracting the same amounts a
// prior applyBall call added, so re-applying then undoing always returns
// the original totals bit-for-bit.
export function reverseBall(totals: InningsTotals, ball: BallInput): InningsTotals {
  return {
    total_runs: totals.total_runs - totalRunsForBall(ball),
    total_wickets: totals.total_wickets - (ball.is_wicket ? 1 : 0),
    legal_balls: totals.legal_balls - (isLegalDelivery(ball.extra_type) ? 1 : 0),
  };
}

export function legalBallsToOversNotation(legalBalls: number): number {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return Number(`${overs}.${balls}`);
}

export function oversNotationToLegalBalls(oversNotation: number): number {
  const overs = Math.floor(oversNotation);
  const balls = Math.round((oversNotation - overs) * 10);
  return overs * 6 + balls;
}

export interface OverPosition {
  over_number: number;
  ball_number_in_over: number;
}

// The position a new delivery is recorded at — illegal deliveries
// (wide/no-ball) are re-bowled, so they get the *current* position rather
// than advancing it.
export function positionForNextBall(legalBallsBeforeThisBall: number): OverPosition {
  return {
    over_number: Math.floor(legalBallsBeforeThisBall / 6),
    ball_number_in_over: (legalBallsBeforeThisBall % 6) + 1,
  };
}

export interface AudioTriggerContext {
  strikerRunsAfterBall: number;
  strikerRunsBeforeBall: number;
  /** Consecutive wickets this bowler has just taken across their last 3 deliveries, including this one. */
  bowlerConsecutiveWickets: number;
  isMatchWinningBall: boolean;
}

// Computed server-side (PRD §12.63 requirement 7) so every viewer plays
// the same sound at the same moment, regardless of client clock skew —
// never left to the client to infer from the raw event.
export function computeAudioTrigger(ball: BallInput, ctx: AudioTriggerContext): AudioTrigger {
  if (ctx.isMatchWinningBall) return 'MATCH_WON';
  if (ball.is_wicket && ctx.bowlerConsecutiveWickets >= 3) return 'HAT_TRICK';
  if (ctx.strikerRunsBeforeBall < 100 && ctx.strikerRunsAfterBall >= 100) {
    return 'CENTURY';
  }
  if (ctx.strikerRunsBeforeBall < 50 && ctx.strikerRunsAfterBall >= 50) return 'FIFTY';
  if (ball.is_wicket) return 'WICKET';
  if (ball.runs_scored === 6 && ball.extra_type === 'NONE') return 'SIX';
  if (ball.runs_scored === 4 && ball.extra_type === 'NONE') return 'FOUR';
  return 'NONE';
}
