import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { getIo, matchRoom } from '../realtime/io';
import {
  applyBall,
  computeAudioTrigger,
  legalBallsToOversNotation,
  oversNotationToLegalBalls,
  positionForNextBall,
  reverseBall,
  runsConcededForBall,
  totalRunsForBall,
  type AudioTrigger,
  type BallInput,
  type ExtraType,
  type InningsTotals,
} from '../domain/scoring';
import {
  ForbiddenActionError,
  InningsNotFoundError,
  InvalidScoringStateError,
  MatchNotFoundError,
  NoBallToUndoError,
} from '../domain/errors';

interface MatchRow {
  match_id: string;
  organizer_id: string;
  assigned_scorer_id: string | null;
  scoring_mode: string;
  match_status: string;
}

interface InningsRow {
  innings_id: string;
  match_id: string;
  innings_number: number;
  batting_match_team_id: string;
  bowling_match_team_id: string;
  total_runs: number;
  total_wickets: number;
  overs_completed: number;
  innings_status: string;
  target_runs: number | null;
}

interface ScoreEventRow {
  score_event_id: string;
  innings_id: string;
  over_number: number;
  ball_number_in_over: number;
  sequence_number: number;
  striker_player_id: string;
  non_striker_player_id: string | null;
  bowler_player_id: string;
  runs_scored: number;
  extra_type: string;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: string | null;
  dismissed_player_id: string | null;
  fielder_player_id: string | null;
  audio_trigger: string;
  recorded_by: string;
  recorded_at: Date;
  is_corrected: boolean;
}

async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const [row] = await sequelize.query<MatchRow>(
    'SELECT match_id, organizer_id, assigned_scorer_id, scoring_mode, match_status FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return row ?? null;
}

// Scorer Selection (PRD §12.19): who may record balls follows the mode
// chosen at Create Game (module 2.6) — turf-staff-managed restricts to the
// assigned scorer specifically, player-managed allows the organizer too
// (standing in for "the batting/fielding captains", which module 2.5/2.6
// don't yet have a dedicated in-match role for).
async function assertCanScore(match: MatchRow, actorUserId: string) {
  if (match.scoring_mode === 'TURF_STAFF_MANAGED') {
    if (match.assigned_scorer_id !== actorUserId) {
      throw new ForbiddenActionError('Only the assigned scorer can record balls for this match.');
    }
    return;
  }
  if (match.organizer_id !== actorUserId && match.assigned_scorer_id !== actorUserId) {
    throw new ForbiddenActionError('Only the match organizer or assigned scorer can record balls.');
  }
}

async function fetchInnings(inningsId: string, transaction?: unknown): Promise<InningsRow | null> {
  const [row] = await sequelize.query<InningsRow>(
    'SELECT * FROM innings WHERE innings_id = :inningsId',
    {
      type: QueryTypes.SELECT,
      replacements: { inningsId },
      transaction: transaction as never,
    },
  );
  return row ?? null;
}

// Locks the innings row for the duration of the transaction so two
// concurrent recordBall calls for the same innings serialize instead of
// racing on sequence_number / cached totals (MySQL row lock — this is
// what actually provides the atomicity requirement 6 asks for; the
// UNIQUE(innings_id, sequence_number) constraint on score_events is the
// second line of defense if a lock is ever bypassed).
async function fetchInningsForUpdate(inningsId: string, transaction: unknown): Promise<InningsRow> {
  const [row] = await sequelize.query<InningsRow>(
    'SELECT * FROM innings WHERE innings_id = :inningsId FOR UPDATE',
    { type: QueryTypes.SELECT, replacements: { inningsId }, transaction: transaction as never },
  );
  if (!row) throw new InningsNotFoundError(inningsId);
  return row;
}

function toTotals(innings: InningsRow): InningsTotals {
  return {
    total_runs: innings.total_runs,
    total_wickets: innings.total_wickets,
    legal_balls: oversNotationToLegalBalls(Number(innings.overs_completed)),
  };
}

function broadcastScoreUpdate(matchId: string, payload: unknown) {
  getIo()
    ?.to(matchRoom(matchId))
    .emit('match:score_update', { matchId, ...(payload as object) });
}

export interface StartInningsInput {
  innings_number: number;
  batting_match_team_id: string;
  bowling_match_team_id: string;
  target_runs?: number | null;
}

export async function startInnings(matchId: string, actorUserId: string, input: StartInningsInput) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanScore(match, actorUserId);

  const inningsId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('innings', [
    {
      innings_id: inningsId,
      match_id: matchId,
      innings_number: input.innings_number,
      batting_match_team_id: input.batting_match_team_id,
      bowling_match_team_id: input.bowling_match_team_id,
      total_runs: 0,
      total_wickets: 0,
      overs_completed: 0,
      innings_status: 'IN_PROGRESS',
      target_runs: input.target_runs ?? null,
      created_at: now,
      updated_at: now,
    },
  ]);
  return fetchInnings(inningsId);
}

export interface RecordBallInput extends BallInput {
  striker_player_id: string;
  non_striker_player_id?: string | null;
  bowler_player_id: string;
  dismissed_player_id?: string | null;
  fielder_player_id?: string | null;
}

// Fetches this batsman's runs-before-this-ball and this bowler's current
// consecutive-wicket streak, purely to feed computeAudioTrigger — reads
// happen inside the same locked transaction as the write, so they can't
// observe a partial concurrent update.
async function getAudioContext(
  inningsId: string,
  strikerPlayerId: string,
  bowlerPlayerId: string,
  transaction: unknown,
): Promise<{ strikerRunsBeforeBall: number; bowlerConsecutiveWickets: number }> {
  const events = await sequelize.query<ScoreEventRow>(
    `SELECT * FROM score_events WHERE innings_id = :inningsId AND is_corrected = FALSE ORDER BY sequence_number ASC`,
    { type: QueryTypes.SELECT, replacements: { inningsId }, transaction: transaction as never },
  );
  const strikerRunsBeforeBall = events
    .filter((e) => e.striker_player_id === strikerPlayerId)
    .reduce((sum, e) => sum + e.runs_scored, 0);

  let consecutiveWickets = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.bowler_player_id !== bowlerPlayerId) continue;
    if (e.is_wicket) {
      consecutiveWickets += 1;
      continue;
    }
    break; // a non-wicket ball from this bowler ends the streak
  }

  return { strikerRunsBeforeBall, bowlerConsecutiveWickets: consecutiveWickets };
}

// The single most important function in this module (PRD §12.18
// requirement 6): every score_events insert and its innings-total update
// happen in one transaction, with the innings row locked for its
// duration, so the two can never drift out of sync under concurrent
// scorer actions.
export async function recordBall(inningsId: string, actorUserId: string, input: RecordBallInput) {
  const [preCheckInnings] = await sequelize.query<{ match_id: string }>(
    'SELECT match_id FROM innings WHERE innings_id = :inningsId',
    { type: QueryTypes.SELECT, replacements: { inningsId } },
  );
  if (!preCheckInnings) throw new InningsNotFoundError(inningsId);
  const match = await fetchMatch(preCheckInnings.match_id);
  if (!match) throw new MatchNotFoundError(preCheckInnings.match_id);
  await assertCanScore(match, actorUserId);

  let insertedEvent: ScoreEventRow | undefined;
  let updatedInnings: InningsRow | undefined;
  let audioTrigger: AudioTrigger = 'NONE';

  await sequelize.transaction(async (transaction) => {
    const innings = await fetchInningsForUpdate(inningsId, transaction);
    if (innings.innings_status !== 'IN_PROGRESS') {
      throw new InvalidScoringStateError('This innings is not in progress.');
    }

    const [{ maxSeq }] = (await sequelize.query<{ maxSeq: number | null }>(
      'SELECT MAX(sequence_number) AS maxSeq FROM score_events WHERE innings_id = :inningsId',
      { type: QueryTypes.SELECT, replacements: { inningsId }, transaction: transaction as never },
    )) as unknown as { maxSeq: number | null }[];
    const sequenceNumber = (maxSeq ?? 0) + 1;

    const totalsBefore = toTotals(innings);
    const position = positionForNextBall(totalsBefore.legal_balls);
    const totalsAfter = applyBall(totalsBefore, input);

    const { strikerRunsBeforeBall, bowlerConsecutiveWickets } = await getAudioContext(
      inningsId,
      input.striker_player_id,
      input.bowler_player_id,
      transaction,
    );
    const isMatchWinningBall =
      innings.target_runs != null && totalsAfter.total_runs >= innings.target_runs;
    audioTrigger = computeAudioTrigger(input, {
      strikerRunsBeforeBall,
      strikerRunsAfterBall: strikerRunsBeforeBall + input.runs_scored,
      bowlerConsecutiveWickets: input.is_wicket ? bowlerConsecutiveWickets + 1 : 0,
      isMatchWinningBall,
    });

    const eventId = randomUUID();
    const now = new Date();
    await sequelize.getQueryInterface().bulkInsert(
      'score_events',
      [
        {
          score_event_id: eventId,
          innings_id: inningsId,
          over_number: position.over_number,
          ball_number_in_over: position.ball_number_in_over,
          sequence_number: sequenceNumber,
          striker_player_id: input.striker_player_id,
          non_striker_player_id: input.non_striker_player_id ?? null,
          bowler_player_id: input.bowler_player_id,
          runs_scored: input.runs_scored,
          extra_type: input.extra_type,
          extra_runs: input.extra_runs,
          is_wicket: input.is_wicket,
          wicket_type: input.wicket_type ?? null,
          dismissed_player_id: input.dismissed_player_id ?? null,
          fielder_player_id: input.fielder_player_id ?? null,
          audio_trigger: audioTrigger,
          recorded_by: actorUserId,
          recorded_at: now,
          is_corrected: false,
          correction_reference_id: null,
        },
      ],
      { transaction },
    );

    await sequelize.getQueryInterface().bulkUpdate(
      'innings',
      {
        total_runs: totalsAfter.total_runs,
        total_wickets: totalsAfter.total_wickets,
        overs_completed: legalBallsToOversNotation(totalsAfter.legal_balls),
        updated_at: now,
      },
      { innings_id: inningsId },
      { transaction },
    );

    insertedEvent = {
      ...input,
      score_event_id: eventId,
      innings_id: inningsId,
      ...position,
      sequence_number: sequenceNumber,
      audio_trigger: audioTrigger,
      recorded_by: actorUserId,
      recorded_at: now,
      is_corrected: false,
      dismissed_player_id: input.dismissed_player_id ?? null,
      fielder_player_id: input.fielder_player_id ?? null,
      non_striker_player_id: input.non_striker_player_id ?? null,
    } as ScoreEventRow;
    updatedInnings = {
      ...innings,
      ...totalsAfter,
      overs_completed: legalBallsToOversNotation(totalsAfter.legal_balls),
    };
  });

  broadcastScoreUpdate(match.match_id, {
    event: insertedEvent,
    innings: updatedInnings,
    audio_trigger: audioTrigger,
  });
  // insertedEvent/updatedInnings are always set inside the transaction
  // above (it either completes fully or throws) — the `!` just tells TS
  // what the runtime already guarantees.
  return { event: insertedEvent!, innings: updatedInnings!, audio_trigger: audioTrigger };
}

// Reverses the last recorded (non-corrected) ball for an innings —
// correctly reverses both the score_events row (marked, not deleted, per
// the schema's is_corrected audit-trail design) and the derived innings
// totals, atomically with the same row-lock discipline as recordBall.
export async function undoLastBall(inningsId: string, actorUserId: string) {
  const [preCheckInnings] = await sequelize.query<{ match_id: string }>(
    'SELECT match_id FROM innings WHERE innings_id = :inningsId',
    { type: QueryTypes.SELECT, replacements: { inningsId } },
  );
  if (!preCheckInnings) throw new InningsNotFoundError(inningsId);
  const match = await fetchMatch(preCheckInnings.match_id);
  if (!match) throw new MatchNotFoundError(preCheckInnings.match_id);
  await assertCanScore(match, actorUserId);

  let updatedInnings: InningsRow | undefined;
  let correctedEventId: string | undefined;

  await sequelize.transaction(async (transaction) => {
    const innings = await fetchInningsForUpdate(inningsId, transaction);

    const [lastEvent] = await sequelize.query<ScoreEventRow>(
      `SELECT * FROM score_events WHERE innings_id = :inningsId AND is_corrected = FALSE
       ORDER BY sequence_number DESC LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { inningsId }, transaction: transaction as never },
    );
    if (!lastEvent) throw new NoBallToUndoError();

    const totalsBefore = toTotals(innings);
    const totalsAfter = reverseBall(totalsBefore, lastEvent as unknown as BallInput);

    await sequelize
      .getQueryInterface()
      .bulkUpdate(
        'score_events',
        { is_corrected: true },
        { score_event_id: lastEvent.score_event_id },
        { transaction },
      );
    await sequelize.getQueryInterface().bulkUpdate(
      'innings',
      {
        total_runs: totalsAfter.total_runs,
        total_wickets: totalsAfter.total_wickets,
        overs_completed: legalBallsToOversNotation(totalsAfter.legal_balls),
        updated_at: new Date(),
      },
      { innings_id: inningsId },
      { transaction },
    );

    correctedEventId = lastEvent.score_event_id;
    updatedInnings = {
      ...innings,
      ...totalsAfter,
      overs_completed: legalBallsToOversNotation(totalsAfter.legal_balls),
    };
  });

  broadcastScoreUpdate(match.match_id, {
    undone_event_id: correctedEventId,
    innings: updatedInnings,
  });
  return { undone_event_id: correctedEventId!, innings: updatedInnings! };
}

// Live Score viewer (PRD §12.18 requirement 3): header info for the
// currently in-progress innings, plus target/RRR/CRR when there's a
// target (2nd innings of a limited-overs match).
export async function getLiveScore(matchId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);

  const [innings] = await sequelize.query<InningsRow>(
    `SELECT * FROM innings WHERE match_id = :matchId ORDER BY innings_number DESC LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (!innings) return { match_id: matchId, innings: null };

  const [lastEvent] = await sequelize.query<ScoreEventRow>(
    `SELECT * FROM score_events WHERE innings_id = :inningsId AND is_corrected = FALSE
     ORDER BY sequence_number DESC LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { inningsId: innings.innings_id } },
  );

  const legalBalls = oversNotationToLegalBalls(Number(innings.overs_completed));
  const crr = legalBalls > 0 ? innings.total_runs / (legalBalls / 6) : 0;
  let rrr: number | null = null;
  if (innings.target_runs != null) {
    const runsNeeded = innings.target_runs - innings.total_runs;
    const ballsLeft = 20 * 6 - legalBalls; // overs cap resolved client-side from match.overs_per_innings if needed; kept simple here
    rrr = ballsLeft > 0 ? runsNeeded / (ballsLeft / 6) : null;
  }

  return {
    match_id: matchId,
    innings,
    current_striker_player_id: lastEvent?.striker_player_id ?? null,
    current_non_striker_player_id: lastEvent?.non_striker_player_id ?? null,
    current_bowler_player_id: lastEvent?.bowler_player_id ?? null,
    current_run_rate: Math.round(crr * 100) / 100,
    required_run_rate: rrr != null ? Math.round(rrr * 100) / 100 : null,
  };
}

// Scorecard (PRD §12.18 requirement 4): aggregated directly from
// score_events at read time — always consistent with the ledger, no
// separate cache that could drift.
export async function getScorecard(matchId: string) {
  const inningsList = await sequelize.query<InningsRow>(
    'SELECT * FROM innings WHERE match_id = :matchId ORDER BY innings_number ASC',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );

  const result = [];
  for (const innings of inningsList) {
    const events = await sequelize.query<
      ScoreEventRow & { striker_bfam_id: string; bowler_bfam_id: string }
    >(
      `SELECT se.*, ps.bfam_id AS striker_bfam_id, pb.bfam_id AS bowler_bfam_id
       FROM score_events se
       JOIN players ps ON ps.player_id = se.striker_player_id
       JOIN players pb ON pb.player_id = se.bowler_player_id
       WHERE se.innings_id = :inningsId AND se.is_corrected = FALSE
       ORDER BY se.sequence_number ASC`,
      { type: QueryTypes.SELECT, replacements: { inningsId: innings.innings_id } },
    );

    const batting = new Map<
      string,
      {
        player_id: string;
        bfam_id: string;
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        out: boolean;
      }
    >();
    const bowling = new Map<
      string,
      {
        player_id: string;
        bfam_id: string;
        overs_balls: number;
        runs_conceded: number;
        wickets: number;
      }
    >();
    const extras = { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 };
    const fallOfWickets: {
      wicket_number: number;
      score: number;
      over: number;
      player_id: string;
      bfam_id: string;
    }[] = [];
    let runningScore = 0;
    let wicketCount = 0;

    for (const e of events) {
      const bat = batting.get(e.striker_player_id) ?? {
        player_id: e.striker_player_id,
        bfam_id: e.striker_bfam_id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
      };
      bat.runs += e.runs_scored;
      if (e.extra_type !== 'WIDE') bat.balls += 1; // wides don't count as a ball faced
      if (e.runs_scored === 4 && e.extra_type === 'NONE') bat.fours += 1;
      if (e.runs_scored === 6 && e.extra_type === 'NONE') bat.sixes += 1;
      batting.set(e.striker_player_id, bat);

      const bowl = bowling.get(e.bowler_player_id) ?? {
        player_id: e.bowler_player_id,
        bfam_id: e.bowler_bfam_id,
        overs_balls: 0,
        runs_conceded: 0,
        wickets: 0,
      };
      bowl.runs_conceded += runsConcededForBall(
        e as unknown as { runs_scored: number; extra_type: ExtraType; extra_runs: number },
      );
      if (e.extra_type !== 'WIDE' && e.extra_type !== 'NO_BALL') bowl.overs_balls += 1;
      if (e.is_wicket && e.wicket_type !== 'RUN_OUT') bowl.wickets += 1; // a run-out isn't credited to the bowler
      bowling.set(e.bowler_player_id, bowl);

      if (e.extra_type !== 'NONE') extras[e.extra_type as keyof typeof extras] += e.extra_runs;

      runningScore += totalRunsForBall(e);
      if (e.is_wicket) {
        wicketCount += 1;
        const dismissedId = e.dismissed_player_id ?? e.striker_player_id;
        const dismissedRow = batting.get(dismissedId);
        if (dismissedRow) dismissedRow.out = true;
        fallOfWickets.push({
          wicket_number: wicketCount,
          score: runningScore,
          over: e.over_number + (e.ball_number_in_over - 1) / 6,
          player_id: dismissedId,
          bfam_id: dismissedRow?.bfam_id ?? '',
        });
      }
    }

    result.push({
      innings_id: innings.innings_id,
      innings_number: innings.innings_number,
      total_runs: innings.total_runs,
      total_wickets: innings.total_wickets,
      overs_completed: innings.overs_completed,
      batting: Array.from(batting.values()),
      bowling: Array.from(bowling.values()).map(({ overs_balls, ...b }) => ({
        ...b,
        overs: legalBallsToOversNotation(overs_balls),
        economy:
          overs_balls > 0 ? Math.round((b.runs_conceded / (overs_balls / 6)) * 100) / 100 : 0,
      })),
      extras,
      fall_of_wickets: fallOfWickets,
    });
  }

  return { match_id: matchId, innings: result };
}

export interface FinalizeMatchInput {
  result_type: 'WIN' | 'TIE' | 'NO_RESULT';
  winning_match_team_id?: string | null;
  winning_margin?: string | null;
  player_of_the_match_id?: string | null;
}

// Match Result (PRD §12.18 requirement 5). Statistics (module 2.10) is a
// stub only from here — see routes/scoring.ts.
export async function finalizeMatch(
  matchId: string,
  actorUserId: string,
  input: FinalizeMatchInput,
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanScore(match, actorUserId);

  const resultId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('match_results', [
    {
      result_id: resultId,
      match_id: matchId,
      winning_match_team_id: input.winning_match_team_id ?? null,
      result_type: input.result_type,
      winning_margin: input.winning_margin ?? null,
      player_of_the_match_id: input.player_of_the_match_id ?? null,
      finalized_at: now,
      finalized_by: actorUserId,
    },
  ]);
  await sequelize
    .getQueryInterface()
    .bulkUpdate('matches', { match_status: 'COMPLETED', updated_at: now }, { match_id: matchId });

  broadcastScoreUpdate(matchId, { audio_trigger: 'MATCH_WON', result_id: resultId });
  return { result_id: resultId };
}

export async function getMatchResult(matchId: string) {
  const [result] = await sequelize.query(
    `SELECT r.*, p.bfam_id AS player_of_the_match_bfam_id
     FROM match_results r
     LEFT JOIN players p ON p.player_id = r.player_of_the_match_id
     WHERE r.match_id = :matchId`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return result ?? null;
}
