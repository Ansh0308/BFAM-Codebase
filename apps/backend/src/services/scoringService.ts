import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/sequelize';
import { getIo, matchRoom } from '../realtime/io';
import { materializeMatchStatistics } from './statisticsService';
import { sendNotificationToMany } from './notificationService';
import {
  applyBall,
  computeAudioTrigger,
  legalBallsToOversNotation,
  officialRunsForBall,
  oversNotationToLegalBalls,
  positionForNextBall,
  reverseBall,
  runsConcededForBall,
  type AudioTrigger,
  type BallInput,
  type ExtraType,
  type InningsTotals,
} from '../domain/scoring';
import {
  computeMatchOutcome,
  pickPlayerOfTheMatch,
  wicketsToEndInnings,
  type PotmCandidate,
} from '../domain/matchOutcome';
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
  extras_count_toward_score: boolean;
  overs_per_innings: number;
  no_non_striker: boolean;
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
    `SELECT match_id, organizer_id, assigned_scorer_id, scoring_mode, match_status,
            extras_count_toward_score, overs_per_innings, no_non_striker
     FROM matches WHERE match_id = :matchId`,
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

// A-21: "team size" is however many players are actually assigned to a
// batting side for this match (match_players.match_team_id, set by
// backlog A-10's Assign Sides step), not a separate fixed setting — an
// 8-a-side match with only 7 assigned auto-ends at 6 wickets, not 7.
// Guarded at >= 2 assigned so an unassigned/malformed side (cap would be
// <= 0) never auto-ends an innings before a ball is even bowled.
async function isAllOut(
  matchId: string,
  battingTeamId: string,
  totalWickets: number,
  transaction: unknown,
  noNonStriker = false,
): Promise<boolean> {
  const [{ count }] = await sequelize.query<{ count: string | number }>(
    `SELECT COUNT(*) AS count FROM match_players
     WHERE match_id = :matchId AND match_team_id = :battingTeamId
       AND invitation_status != 'CANT_PLAY'`,
    {
      type: QueryTypes.SELECT,
      replacements: { matchId, battingTeamId },
      transaction: transaction as never,
    },
  );
  const assignedBattingCount = Number(count);
  // Single-batter (box cricket) mode: every batter gets to bat, so the
  // innings only ends once they're ALL out, not size - 1.
  return (
    assignedBattingCount >= 2 &&
    totalWickets >= wicketsToEndInnings(assignedBattingCount, noNonStriker)
  );
}

// A-19: an innings also ends the moment the overs allotment is used up, or
// (2nd innings only) the chased target is reached — the same
// auto-completion path A-21 already built for all-out, just two more
// trigger conditions feeding the same `innings_status = 'COMPLETED'`
// transition, so undoLastBall's existing reopen logic covers all three for
// free by re-checking this same function post-reversal.
async function isInningsComplete(
  match: MatchRow,
  innings: InningsRow,
  totals: InningsTotals,
  transaction: unknown,
): Promise<boolean> {
  const allOut = await isAllOut(
    match.match_id,
    innings.batting_match_team_id,
    totals.total_wickets,
    transaction,
    match.no_non_striker,
  );
  const oversComplete = totals.legal_balls >= match.overs_per_innings * 6;
  const targetReached = innings.target_runs != null && totals.total_runs >= innings.target_runs;
  return allOut || oversComplete || targetReached;
}

function broadcastScoreUpdate(matchId: string, payload: unknown) {
  getIo()
    ?.to(matchRoom(matchId))
    .emit('match:score_update', { matchId, ...(payload as object) });
}

// Extras Toggle (backlog A-8): must be set before the first innings is
// started — once balls are being recorded against a running total, letting
// the rule change mid-innings would make every ball scored so far
// ambiguous about which rule it followed. Idempotent otherwise, same as
// the other pre-scoring intro settings.
export async function setExtrasCountTowardScore(
  matchId: string,
  actorUserId: string,
  extrasCountTowardScore: boolean,
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanScore(match, actorUserId);

  const [existingInnings] = await sequelize.query<{ innings_id: string }>(
    'SELECT innings_id FROM innings WHERE match_id = :matchId LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (existingInnings) {
    throw new InvalidScoringStateError(
      'The extras setting can only be changed before scoring starts.',
    );
  }

  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'matches',
      { extras_count_toward_score: extrasCountTowardScore },
      { match_id: matchId },
    );

  return { extras_count_toward_score: extrasCountTowardScore };
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
  // A new innings starting means whatever innings was previously in progress
  // for this match is done — nothing else ever marks an innings COMPLETED,
  // so without this every prior innings would stay "live" forever.
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'innings',
      { innings_status: 'COMPLETED', updated_at: now },
      { match_id: matchId, innings_status: 'IN_PROGRESS' },
    );
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
    const totalsAfter = applyBall(totalsBefore, input, match.extras_count_toward_score);
    const complete = await isInningsComplete(match, innings, totalsAfter, transaction);

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
        ...(complete ? { innings_status: 'COMPLETED' } : {}),
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
      innings_status: complete ? 'COMPLETED' : innings.innings_status,
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
    const totalsAfter = reverseBall(
      totalsBefore,
      lastEvent as unknown as BallInput,
      match.extras_count_toward_score,
    );
    // A-19/A-21: undoing the ball that auto-completed the innings (all
    // out, overs used up, or target reached — see recordBall) must reopen
    // it for scoring, whichever of those three caused it, otherwise it
    // stays stuck COMPLETED with nothing left to blame it on.
    const reopens =
      innings.innings_status === 'COMPLETED' &&
      !(await isInningsComplete(match, innings, totalsAfter, transaction));

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
        ...(reopens ? { innings_status: 'IN_PROGRESS' } : {}),
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
      innings_status: reopens ? 'IN_PROGRESS' : innings.innings_status,
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
    // A-19 fix: this used to hardcode a 20-over (T20) cap regardless of
    // the match's actual format, badly overstating required run rate for
    // any shorter match (this app's matches are typically far fewer than
    // 20 overs).
    const ballsLeft = match.overs_per_innings * 6 - legalBalls;
    rrr = ballsLeft > 0 ? runsNeeded / (ballsLeft / 6) : null;
  }

  return {
    match_id: matchId,
    innings,
    extras_count_toward_score: match.extras_count_toward_score,
    current_striker_player_id: lastEvent?.striker_player_id ?? null,
    current_non_striker_player_id: lastEvent?.non_striker_player_id ?? null,
    current_bowler_player_id: lastEvent?.bowler_player_id ?? null,
    current_run_rate: Math.round(crr * 100) / 100,
    required_run_rate: rrr != null ? Math.round(rrr * 100) / 100 : null,
    overs_per_innings: match.overs_per_innings,
  };
}

// Scorecard (PRD §12.18 requirement 4): aggregated directly from
// score_events at read time — always consistent with the ledger, no
// separate cache that could drift.
export async function getScorecard(matchId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);

  const inningsList = await sequelize.query<InningsRow>(
    'SELECT * FROM innings WHERE match_id = :matchId ORDER BY innings_number ASC',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );

  const teamNames = await getMatchTeamNames(matchId);
  const result = [];
  for (const innings of inningsList) {
    const events = await sequelize.query<
      ScoreEventRow & {
        striker_bfam_id: string;
        striker_full_name: string | null;
        bowler_bfam_id: string;
        bowler_full_name: string | null;
      }
    >(
      `SELECT se.*, ps.bfam_id AS striker_bfam_id, ps.full_name AS striker_full_name,
              pb.bfam_id AS bowler_bfam_id, pb.full_name AS bowler_full_name
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
        full_name: string | null;
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
        full_name: string | null;
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
      full_name: string | null;
    }[] = [];
    let runningScore = 0;
    let wicketCount = 0;

    for (const e of events) {
      const bat = batting.get(e.striker_player_id) ?? {
        player_id: e.striker_player_id,
        bfam_id: e.striker_bfam_id,
        full_name: e.striker_full_name,
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
        full_name: e.bowler_full_name,
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

      runningScore += officialRunsForBall(e, match.extras_count_toward_score);
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
          full_name: dismissedRow?.full_name ?? null,
        });
      }
    }

    // A-22: team run rate, alongside the bowler economy this function
    // already computes the same way (runs / (legal balls / 6)).
    const totalLegalBalls = oversNotationToLegalBalls(Number(innings.overs_completed));
    result.push({
      innings_id: innings.innings_id,
      innings_number: innings.innings_number,
      batting_match_team_id: innings.batting_match_team_id,
      batting_team_name: teamNames.get(innings.batting_match_team_id) ?? null,
      total_runs: innings.total_runs,
      total_wickets: innings.total_wickets,
      overs_completed: innings.overs_completed,
      run_rate:
        totalLegalBalls > 0
          ? Math.round((innings.total_runs / (totalLegalBalls / 6)) * 100) / 100
          : 0,
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

  return {
    match_id: matchId,
    extras_count_toward_score: match.extras_count_toward_score,
    innings: result,
  };
}

// All input fields are optional: with no result_type the result is worked out
// from the scorecard (computeMatchOutcome + pickPlayerOfTheMatch). Explicit
// fields are still accepted so an admin/API caller can override.
export interface FinalizeMatchInput {
  result_type?: 'WIN' | 'TIE' | 'NO_RESULT';
  winning_match_team_id?: string | null;
  winning_margin?: string | null;
  player_of_the_match_id?: string | null;
}

interface ResolvedResult {
  result_type: 'WIN' | 'TIE' | 'NO_RESULT';
  winning_match_team_id: string | null;
  winning_margin: string | null;
  player_of_the_match_id: string | null;
}

interface MatchTeamName {
  match_team_id: string;
  side_label: 'TEAM_A' | 'TEAM_B';
  team_name: string | null;
}

// Name shown for a side: the name set on Match Setup, else the linked real
// team's name, else "Team A"/"Team B".
async function getMatchTeamNames(matchId: string): Promise<Map<string, string>> {
  const rows = await sequelize.query<MatchTeamName>(
    `SELECT mt.match_team_id, mt.side_label, COALESCE(mt.team_name, t.team_name) AS team_name
     FROM match_teams mt
     LEFT JOIN teams t ON t.team_id = mt.team_id
     WHERE mt.match_id = :matchId`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  return new Map(
    rows.map((r) => [
      r.match_team_id,
      r.team_name ?? (r.side_label === 'TEAM_A' ? 'Team A' : 'Team B'),
    ]),
  );
}

// Works the result out from what was scored: winner + margin from the two
// innings, Player of the Match from per-player runs/wickets.
async function computeAutoResult(match: MatchRow): Promise<ResolvedResult> {
  const inningsList = await sequelize.query<InningsRow>(
    'SELECT * FROM innings WHERE match_id = :matchId ORDER BY innings_number ASC',
    { type: QueryTypes.SELECT, replacements: { matchId: match.match_id } },
  );

  const chasingTeamId = inningsList[1]?.batting_match_team_id ?? null;
  let battingTeamSize: number | null = null;
  if (chasingTeamId) {
    const [{ count }] = await sequelize.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM match_players
       WHERE match_id = :matchId AND match_team_id = :teamId AND invitation_status != 'CANT_PLAY'`,
      { type: QueryTypes.SELECT, replacements: { matchId: match.match_id, teamId: chasingTeamId } },
    );
    battingTeamSize = Number(count);
  }

  const outcome = computeMatchOutcome(inningsList, {
    battingTeamSize,
    noNonStriker: Boolean(match.no_non_striker),
  });

  const roster = await sequelize.query<{ player_id: string; match_team_id: string | null }>(
    'SELECT player_id, match_team_id FROM match_players WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId: match.match_id } },
  );
  const sideOf = new Map(roster.map((r) => [r.player_id, r.match_team_id]));
  const scorecard = await getScorecard(match.match_id);
  const totals = new Map<string, PotmCandidate>();
  const touch = (playerId: string) => {
    let c = totals.get(playerId);
    if (!c) {
      c = { player_id: playerId, runs: 0, wickets: 0, match_team_id: sideOf.get(playerId) ?? null };
      totals.set(playerId, c);
    }
    return c;
  };
  for (const inn of scorecard.innings) {
    for (const b of inn.batting) if (sideOf.has(b.player_id)) touch(b.player_id).runs += b.runs;
    for (const b of inn.bowling) {
      if (sideOf.has(b.player_id)) touch(b.player_id).wickets += b.wickets;
    }
  }

  return {
    ...outcome,
    player_of_the_match_id: pickPlayerOfTheMatch(
      [...totals.values()],
      outcome.winning_match_team_id,
    ),
  };
}

// Match Result (PRD §12.18 requirement 5). Materializes Match Statistics
// & Basic Skill Rating (module 2.10, PRD §12.21/§12.29) immediately after —
// the result row (winning side, Player of the Match) must exist first,
// since the rating calculation depends on both.
// Idempotent: a second call (the result screen and the scorer's Finish
// Match button can race) returns the existing result instead of inserting
// a duplicate.
export async function finalizeMatch(
  matchId: string,
  actorUserId: string,
  input: FinalizeMatchInput = {},
) {
  const match = await fetchMatch(matchId);
  if (!match) throw new MatchNotFoundError(matchId);
  await assertCanScore(match, actorUserId);

  const [existing] = await sequelize.query<{ result_id: string }>(
    'SELECT result_id FROM match_results WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (existing) return { result_id: existing.result_id, already_finalized: true };

  const resolved: ResolvedResult = input.result_type
    ? {
        result_type: input.result_type,
        winning_match_team_id: input.winning_match_team_id ?? null,
        winning_margin: input.winning_margin ?? null,
        player_of_the_match_id: input.player_of_the_match_id ?? null,
      }
    : await computeAutoResult(match);

  const resultId = randomUUID();
  const now = new Date();
  await sequelize.getQueryInterface().bulkInsert('match_results', [
    {
      result_id: resultId,
      match_id: matchId,
      winning_match_team_id: resolved.winning_match_team_id,
      result_type: resolved.result_type,
      winning_margin: resolved.winning_margin,
      player_of_the_match_id: resolved.player_of_the_match_id,
      finalized_at: now,
      finalized_by: actorUserId,
    },
  ]);
  await sequelize
    .getQueryInterface()
    .bulkUpdate('matches', { match_status: 'COMPLETED', updated_at: now }, { match_id: matchId });
  // The last innings never gets closed out by startInnings (there's no next
  // innings to trigger it), so finalizing the match has to do it here —
  // otherwise that innings stays IN_PROGRESS forever.
  await sequelize
    .getQueryInterface()
    .bulkUpdate(
      'innings',
      { innings_status: 'COMPLETED', updated_at: now },
      { match_id: matchId, innings_status: 'IN_PROGRESS' },
    );

  await materializeMatchStatistics(matchId);
  await notifyMatchResult(matchId, resolved).catch((error) => {
    console.error(`[scoringService] Failed to send MATCH_RESULT for ${matchId}:`, error);
  });

  broadcastScoreUpdate(matchId, { audio_trigger: 'MATCH_WON', result_id: resultId });
  return { result_id: resultId, already_finalized: false };
}

// MATCH_RESULT (module 2.11, PRD §12.45) — every confirmed roster player.
// Failures are caught by the caller above — never allowed to fail
// finalizeMatch itself, which has already committed the real result.
async function notifyMatchResult(matchId: string, input: ResolvedResult) {
  const [matchRow] = await sequelize.query<{ match_name: string | null }>(
    'SELECT match_name FROM matches WHERE match_id = :matchId',
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  const matchName = matchRow?.match_name ?? 'Your match';

  let resultSummary: string;
  if (input.result_type === 'TIE') {
    resultSummary = 'Match tied';
  } else if (input.result_type === 'NO_RESULT') {
    resultSummary = 'No result';
  } else {
    const names = await getMatchTeamNames(matchId);
    const winnerName = names.get(input.winning_match_team_id ?? '') ?? 'A team';
    resultSummary = `${winnerName} won${input.winning_margin ? ` by ${input.winning_margin}` : ''}`;
  }

  const recipients = await sequelize.query<{ user_id: string }>(
    `SELECT p.user_id FROM match_players mp
     JOIN players p ON p.player_id = mp.player_id
     WHERE mp.match_id = :matchId AND mp.invitation_status = 'CONFIRMED'`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  await sendNotificationToMany(
    recipients.map((r) => r.user_id),
    'MATCH_RESULT',
    { matchName, resultSummary },
    'match',
    matchId,
  );
}

// The result plus everything the summary screen needs to render without more
// round trips: the winning team's name and the Player of the Match by NAME
// (BFAM ID only as a fallback for a player who never set one) with their
// line from the materialized match statistics.
export async function getMatchResult(matchId: string) {
  const [result] = await sequelize.query<Record<string, unknown>>(
    `SELECT r.*, p.bfam_id AS player_of_the_match_bfam_id,
            p.full_name AS player_of_the_match_name
     FROM match_results r
     LEFT JOIN players p ON p.player_id = r.player_of_the_match_id
     WHERE r.match_id = :matchId`,
    { type: QueryTypes.SELECT, replacements: { matchId } },
  );
  if (!result) return null;

  const names = await getMatchTeamNames(matchId);
  let potmStats: {
    runs: number;
    balls: number;
    wickets: number;
    runs_conceded: number;
  } | null = null;
  if (result.player_of_the_match_id) {
    const [stats] = await sequelize.query<{
      runs_scored: number;
      balls_faced: number;
      wickets_taken: number;
      runs_conceded: number;
    }>(
      `SELECT runs_scored, balls_faced, wickets_taken, runs_conceded
       FROM player_match_statistics WHERE match_id = :matchId AND player_id = :playerId`,
      {
        type: QueryTypes.SELECT,
        replacements: { matchId, playerId: result.player_of_the_match_id },
      },
    );
    if (stats) {
      potmStats = {
        runs: Number(stats.runs_scored),
        balls: Number(stats.balls_faced),
        wickets: Number(stats.wickets_taken),
        runs_conceded: Number(stats.runs_conceded),
      };
    }
  }

  return {
    ...result,
    winning_team_name: result.winning_match_team_id
      ? (names.get(result.winning_match_team_id as string) ?? null)
      : null,
    player_of_the_match_stats: potmStats,
  };
}
