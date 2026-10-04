'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Flag,
  Radio,
  RotateCcw,
  Swords,
  Trophy,
  Undo2,
} from 'lucide-react';
import { BFAMApiError } from '@bfam/api-client';
import {
  matchTeamLabel,
  type BattingRow,
  type BowlingRow,
  type ExtraType,
  type GameRoom,
  type Innings,
  type IntroMatchTeam,
  type LiveScore,
  type MatchIntro,
  type MatchResult,
  type WicketType,
} from '@bfam/shared-types';
import { apiClient } from '../../lib/apiClient';
import {
  advanceCrease,
  ballColor,
  ballLabel,
  isLegalDelivery,
  legalBallsFromOvers,
  overRuns,
  restoreCrease,
} from '../../lib/crease';
import { PageHeader } from '../DashboardShell';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Drawer } from '../ui/Drawer';
import { EASE_OUT } from '../ui/motion';
import { Toggle } from '../ui/Toggle';
import { useToast } from '../ui/Toast';
import { Button, EmptyState, SkeletonRows, StatusPill } from '../ui/kit';

const WICKET_TYPES: { value: WicketType; label: string }[] = [
  { value: 'BOWLED', label: 'Bowled' },
  { value: 'CAUGHT', label: 'Caught' },
  { value: 'RUN_OUT', label: 'Run out' },
  { value: 'STUMPED', label: 'Stumped' },
  { value: 'LBW', label: 'LBW' },
  { value: 'HIT_WICKET', label: 'Hit wicket' },
  { value: 'RETIRED', label: 'Retired' },
];
type ExtraKind = Exclude<ExtraType, 'NONE'>;
const EXTRAS: { kind: ExtraKind; label: string; hint: string }[] = [
  { kind: 'WIDE', label: 'Wide', hint: 'wd' },
  { kind: 'NO_BALL', label: 'No ball', hint: 'nb' },
  { kind: 'LEG_BYE', label: 'Leg bye', hint: 'lb' },
  { kind: 'BYE', label: 'Bye', hint: 'b' },
];
type SheetKind = 'striker' | 'nonStriker' | 'bowler' | 'wicket' | 'runOut' | null;

function nameOf(p: { full_name?: string | null; bfam_id?: string }): string {
  return p.full_name || p.bfam_id || '';
}

function completionReason(innings: Innings, oversPerInnings: number | undefined): string {
  if (innings.target_runs != null && innings.total_runs >= innings.target_runs) {
    return `Target chased — ${innings.total_runs}/${innings.total_wickets}`;
  }
  if (oversPerInnings != null && innings.overs_completed >= oversPerInnings) {
    return `Overs complete — ${innings.total_runs}/${innings.total_wickets}`;
  }
  return `All out — ${innings.total_wickets} wickets down`;
}

// Web live-scoring console (PRD §9.2 / §9.3): the same ball-by-ball flow as the
// mobile scorer — toss, openers, runs, extras, wickets, new batter / bowler
// prompts, undo, end innings, finish — on a desktop layout with keyboard
// shortcuts (0–6 runs, W wicket, U undo, X swap strike). The backend enforces
// who may score; for turf-managed matches that is the turf's owner and
// approved staff.
export function ScoringConsole({ matchId, backHref }: { matchId: string; backHref: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [intro, setIntro] = useState<MatchIntro | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [live, setLive] = useState<LiveScore | null>(null);
  const [battingRows, setBattingRows] = useState<BattingRow[]>([]);
  const [bowlingRows, setBowlingRows] = useState<BowlingRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const [prevBowlerId, setPrevBowlerId] = useState<string | null>(null);
  const [pendingExtra, setPendingExtra] = useState<ExtraKind | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  // pre-innings choices
  const [battingSide, setBattingSide] = useState<string | null>(null);
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL'>('BAT');
  const [extrasCount, setExtrasCount] = useState(true);

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  const load = useCallback(async () => {
    try {
      const [gameRoom, introCtx, liveScore, scorecard] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
        apiClient.getLiveScore(matchId),
        apiClient.getScorecard(matchId).catch(() => null),
      ]);
      setRoom(gameRoom);
      setIntro(introCtx?.intro ?? null);
      setMatchTeams(introCtx?.matchTeams ?? gameRoom.match_teams ?? []);
      setLive(liveScore);
      if (scorecard) setExtrasCount(scorecard.extras_count_toward_score);

      const card = scorecard?.innings.find((i) => i.innings_id === liveScore.innings?.innings_id);
      setBattingRows(card?.batting ?? []);
      setBowlingRows(card?.bowling ?? []);
      setDismissed(new Set(card?.batting.filter((b) => b.out).map((b) => b.player_id) ?? []));

      if (gameRoom.match_status === 'COMPLETED') {
        apiClient
          .getMatchResult(matchId)
          .then(setResult)
          .catch(() => setResult(null));
      }

      // The toss already decided who bats — prefill until an innings exists.
      if (
        introCtx?.intro.toss_winner_match_team_id &&
        introCtx.intro.toss_decision &&
        !liveScore.innings
      ) {
        const winner = introCtx.intro.toss_winner_match_team_id;
        const other =
          introCtx.matchTeams.find((t) => t.match_team_id !== winner)?.match_team_id ?? null;
        setBattingSide((prev) => prev ?? (introCtx.intro.toss_decision === 'BAT' ? winner : other));
      }

      // First time this innings is seen here: rebuild the crease from the
      // last ball instead of asking again.
      const inn = liveScore.innings;
      if (inn && restoredFor !== inn.innings_id) {
        setRestoredFor(inn.innings_id);
        const crease = restoreCrease(liveScore);
        setStrikerId(crease.strikerId);
        setNonStrikerId(crease.nonStrikerId);
        const legal = legalBallsFromOvers(Number(inn.overs_completed));
        const last = liveScore.last_ball;
        const overJustEnded =
          !!last && isLegalDelivery(last.extra_type) && legal > 0 && legal % 6 === 0;
        if (overJustEnded && inn.innings_status === 'IN_PROGRESS') {
          setPrevBowlerId(liveScore.current_bowler_player_id ?? null);
          setBowlerId(null);
        } else {
          setBowlerId(liveScore.current_bowler_player_id ?? null);
        }
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof BFAMApiError ? err.message : 'Could not load this match.');
    } finally {
      setLoading(false);
    }
  }, [matchId, restoredFor]);

  useEffect(() => {
    load();
    // load depends on restoredFor; only run on mount / match change
  }, [matchId]);

  const singleBatter = live?.no_non_striker ?? room?.no_non_striker ?? false;
  const innings = live?.innings ?? null;
  const inProgress = innings?.innings_status === 'IN_PROGRESS';
  const legalBalls = innings ? legalBallsFromOvers(Number(innings.overs_completed)) : 0;
  const overNumber = Math.floor(legalBalls / 6);

  const eligible = useMemo(
    () => room?.players.filter((p) => p.invitation_status !== 'CANT_PLAY') ?? [],
    [room],
  );
  const allSidesAssigned = eligible.length > 0 && eligible.every((p) => p.match_team_id);

  const optionsFor = useCallback(
    (teamId: string | null) =>
      eligible
        .filter((p) => !p.match_team_id || !teamId || p.match_team_id === teamId)
        .map((p) => ({ value: p.player_id, label: nameOf(p) })),
    [eligible],
  );
  const battingOptions = (innings ? optionsFor(innings.batting_match_team_id) : []).filter(
    (o) => !dismissed.has(o.value),
  );
  const bowlingOptions = innings ? optionsFor(innings.bowling_match_team_id) : [];
  const playerName = (id: string | null) =>
    id
      ? eligible.find((p) => p.player_id === id)
        ? nameOf(eligible.find((p) => p.player_id === id)!)
        : ''
      : '';
  const teamName = (id: string | null | undefined) => {
    const t = matchTeams.find((m) => m.match_team_id === id);
    return t ? matchTeamLabel(t) : '';
  };

  const canScore =
    inProgress && !busy && !!strikerId && !!bowlerId && (singleBatter || !!nonStrikerId);

  function missingPick(
    o: { striker?: string | null; nonStriker?: string | null; bowler?: string | null } = {},
  ): 'striker' | 'nonStriker' | 'bowler' | null {
    const s = 'striker' in o ? o.striker : strikerId;
    const n = 'nonStriker' in o ? o.nonStriker : nonStrikerId;
    const b = 'bowler' in o ? o.bowler : bowlerId;
    if (!s) return 'striker';
    if (!singleBatter && !n) return 'nonStriker';
    if (!b) return 'bowler';
    return null;
  }

  // Ask for whoever is missing at the moments that matter: a new innings, a
  // wicket, a new over.
  const promptKey = `${innings?.innings_id}-${innings?.total_wickets}-${overNumber}`;
  useEffect(() => {
    if (loading || !inProgress || sheet) return;
    const missing = missingPick();
    if (!missing) return;
    if (missing !== 'bowler' && (innings?.total_wickets ?? 0) > 0) {
      const taken = new Set([strikerId, nonStrikerId].filter(Boolean) as string[]);
      const left = battingOptions.filter((o) => !taken.has(o.value));
      if (left.length === 1) {
        if (missing === 'striker') setStrikerId(left[0].value);
        else setNonStrikerId(left[0].value);
        return;
      }
    }
    setSheet(missing);
  }, [promptKey, loading, restoredFor]);

  function afterPick(o: Parameters<typeof missingPick>[0]) {
    setSheet(missingPick(o));
  }

  async function run<T>(action: () => Promise<T>, failure: string): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : failure);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function beginMatch() {
    await run(async () => {
      await apiClient.startMatchIntro(matchId);
      await load();
    }, 'Could not start the match.');
  }

  async function saveToss() {
    if (!tossWinner) return;
    await run(async () => {
      await apiClient.recordToss(matchId, tossWinner, tossDecision);
      await load();
    }, 'Could not record the toss.');
  }

  async function startFirstInnings() {
    if (!battingSide) return;
    const bowlingSide = matchTeams.find((t) => t.match_team_id !== battingSide)?.match_team_id;
    if (!bowlingSide) return;
    await run(async () => {
      await apiClient.setExtrasCountTowardScore(matchId, extrasCount).catch(() => undefined);
      await apiClient.startInnings(matchId, {
        innings_number: 1,
        batting_match_team_id: battingSide,
        bowling_match_team_id: bowlingSide,
        target_runs: null,
      });
      await load();
    }, 'Could not start the innings.');
  }

  async function startNextInnings() {
    if (!innings) return;
    await run(async () => {
      await apiClient.startInnings(matchId, {
        innings_number: innings.innings_number + 1,
        batting_match_team_id: innings.bowling_match_team_id,
        bowling_match_team_id: innings.batting_match_team_id,
        target_runs: innings.total_runs + 1,
      });
      setStrikerId(null);
      setNonStrikerId(null);
      setBowlerId(null);
      setPrevBowlerId(null);
      setSheet(null);
      setRestoredFor(null);
      await load();
    }, 'Could not start the next innings.');
  }

  async function finishMatch() {
    await run(async () => {
      await apiClient.finalizeMatch(matchId, {});
      toast.success('Match finished');
      await load();
    }, 'Could not finish the match.');
  }

  async function submitBall(input: {
    runs_scored: number;
    extra_type: ExtraType;
    extra_runs: number;
    is_wicket: boolean;
    wicket_type?: WicketType | null;
    dismissed_player_id?: string | null;
  }) {
    if (!innings || !strikerId || !bowlerId) return;
    await run(async () => {
      const res = await apiClient.recordBall(innings.innings_id, {
        striker_player_id: strikerId,
        non_striker_player_id: singleBatter ? null : nonStrikerId,
        bowler_player_id: bowlerId,
        ...input,
      });
      const legalAfter = legalBallsFromOvers(Number(res.innings.overs_completed));
      const overEnded = isLegalDelivery(input.extra_type) && legalAfter > 0 && legalAfter % 6 === 0;
      const next = advanceCrease({ strikerId, nonStrikerId }, input, { singleBatter, overEnded });
      setStrikerId(next.strikerId);
      setNonStrikerId(next.nonStrikerId);
      if (overEnded && res.innings.innings_status === 'IN_PROGRESS') {
        setPrevBowlerId(bowlerId);
        setBowlerId(null);
      }
      setPendingExtra(null);
      setSheet(null);
      if (input.is_wicket) toast.info('Wicket!');
      else if (input.runs_scored === 6) toast.success('SIX!');
      else if (input.runs_scored === 4) toast.success('FOUR!');
      await load();
    }, 'Could not record that ball.');
  }

  function pressRun(n: number) {
    if (!canScore) return;
    if (pendingExtra) {
      const wideOrNoBall = pendingExtra === 'WIDE' || pendingExtra === 'NO_BALL';
      submitBall({
        runs_scored: wideOrNoBall ? 0 : n,
        extra_type: pendingExtra,
        extra_runs: wideOrNoBall ? 1 + n : n,
        is_wicket: false,
      });
      return;
    }
    submitBall({ runs_scored: n, extra_type: 'NONE', extra_runs: 0, is_wicket: false });
  }

  function chooseWicket(type: WicketType) {
    if (type === 'RUN_OUT' && !singleBatter && nonStrikerId) {
      setSheet('runOut');
      return;
    }
    submitBall({
      runs_scored: 0,
      extra_type: 'NONE',
      extra_runs: 0,
      is_wicket: true,
      wicket_type: type,
      dismissed_player_id: strikerId,
    });
  }

  function confirmRunOut(dismissedId: string) {
    submitBall({
      runs_scored: 0,
      extra_type: 'NONE',
      extra_runs: 0,
      is_wicket: true,
      wicket_type: 'RUN_OUT',
      dismissed_player_id: dismissedId,
    });
  }

  async function undo() {
    if (!innings) return;
    await run(async () => {
      const res = await apiClient.undoBall(innings.innings_id);
      if (res.undone_event) {
        setStrikerId(res.undone_event.striker_player_id);
        setNonStrikerId(singleBatter ? null : res.undone_event.non_striker_player_id);
        setBowlerId(res.undone_event.bowler_player_id);
        setPrevBowlerId(null);
      }
      setPendingExtra(null);
      setSheet(null);
      await load();
    }, 'Nothing to undo.');
  }

  function swapStrike() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  // Keyboard shortcuts for the scorer's hands: 0–6, W, U, X.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || sheet || confirmEnd || confirmFinish) return;
      if (/^[0-6]$/.test(e.key)) pressRun(Number(e.key));
      else if (e.key.toLowerCase() === 'w' && canScore) setSheet('wicket');
      else if (e.key.toLowerCase() === 'u' && !busy) undo();
      else if (e.key.toLowerCase() === 'x' && !singleBatter && canScore) swapStrike();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- render ---------------------------------------------------------------

  if (loading) {
    return (
      <div data-testid="scoring-loading">
        <PageHeader title="Scoring" />
        <SkeletonRows rows={4} />
      </div>
    );
  }
  if (loadError || !room) {
    return (
      <div data-testid="scoring-error">
        <PageHeader title="Scoring" />
        <EmptyState
          icon={Swords}
          title="Could not open this match"
          message={loadError ?? 'Could not load this match.'}
          action={
            <Link href={backHref}>
              <Button variant="secondary" icon={ArrowLeft}>
                Back
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const title = room.match_name ?? 'Match';
  const matchDone = room.match_status === 'COMPLETED' || room.match_status === 'CANCELLED';

  const header = (
    <PageHeader
      title="Scoring"
      subtitle={title}
      action={
        <div className="flex items-center gap-3">
          <StatusPill
            label={room.match_status.replace('_', ' ')}
            tone={room.match_status === 'IN_PROGRESS' ? 'brand' : 'neutral'}
            pulse={room.match_status === 'IN_PROGRESS'}
          />
          <Link href={backHref}>
            <Button variant="secondary" icon={ArrowLeft} testID="scoring-back">
              Matches
            </Button>
          </Link>
        </div>
      }
    />
  );

  // Finished
  if (matchDone) {
    return (
      <div data-testid="scoring-console">
        {header}
        <div
          className="rounded-lg border border-border-subtle bg-surface p-8 text-center"
          data-testid="match-finished"
        >
          <Trophy className="mx-auto h-[40px] w-[40px] text-brand-red" />
          <p className="mt-3 font-display text-[32px] uppercase tracking-wide text-ink-black">
            {result?.winning_team_name
              ? `${result.winning_team_name} won`
              : result?.result_type === 'TIE'
                ? 'Match tied'
                : 'Match finished'}
          </p>
          {result?.winning_margin && (
            <p className="font-ui text-card-title text-text-secondary">{result.winning_margin}</p>
          )}
          {result?.player_of_the_match_name && (
            <p className="mt-2 font-ui text-body text-text-tertiary">
              Player of the match: {result.player_of_the_match_name}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Before the first innings
  if (!innings) {
    const started = room.match_status === 'IN_PROGRESS' || !!intro;
    const tossDone = !!intro?.toss_winner_match_team_id;
    return (
      <div data-testid="scoring-console">
        {header}
        <div className="grid max-w-3xl gap-5" data-testid="scoring-setup">
          {!allSidesAssigned && (
            <p
              role="alert"
              data-testid="sides-warning"
              className="rounded-md bg-status-warning-bg px-4 py-3 font-ui text-body text-status-warning"
            >
              Every player needs a side before scoring. Assign teams in Match Setup first.
            </p>
          )}

          <SetupCard step={1} title="Begin the match" done={started}>
            {started ? (
              <p className="font-ui text-body text-text-secondary">Match is open for scoring.</p>
            ) : (
              <Button loading={busy} onClick={beginMatch} icon={Radio} testID="begin-match">
                Begin match
              </Button>
            )}
          </SetupCard>

          <SetupCard step={2} title="Toss" done={tossDone} disabled={!started}>
            {tossDone ? (
              <p className="font-ui text-body text-text-secondary">
                {teamName(intro?.toss_winner_match_team_id)} won the toss and chose to{' '}
                {intro?.toss_decision === 'BAT' ? 'bat' : 'bowl'}.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  {matchTeams.map((t) => (
                    <ChoiceChip
                      key={t.match_team_id}
                      active={tossWinner === t.match_team_id}
                      onClick={() => setTossWinner(t.match_team_id)}
                      testID={`toss-winner-${t.side_label}`}
                    >
                      {matchTeamLabel(t)} won
                    </ChoiceChip>
                  ))}
                </div>
                <div className="mt-3 flex gap-3">
                  <ChoiceChip
                    active={tossDecision === 'BAT'}
                    onClick={() => setTossDecision('BAT')}
                    testID="toss-bat"
                  >
                    Chose to bat
                  </ChoiceChip>
                  <ChoiceChip
                    active={tossDecision === 'BOWL'}
                    onClick={() => setTossDecision('BOWL')}
                    testID="toss-bowl"
                  >
                    Chose to bowl
                  </ChoiceChip>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={saveToss}
                    loading={busy}
                    disabled={!tossWinner || !started}
                    testID="save-toss"
                  >
                    Record toss
                  </Button>
                </div>
              </>
            )}
          </SetupCard>

          <SetupCard step={3} title="Who bats first?" disabled={!started}>
            <div className="flex flex-wrap gap-3">
              {matchTeams.map((t) => (
                <ChoiceChip
                  key={t.match_team_id}
                  active={battingSide === t.match_team_id}
                  onClick={() => setBattingSide(t.match_team_id)}
                  testID={`batting-side-${t.side_label}`}
                >
                  {matchTeamLabel(t)}
                </ChoiceChip>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-md bg-ink-black/[0.04] px-4 py-3">
              <div>
                <p className="font-ui text-body font-semibold text-ink-black">
                  Extras count toward the score
                </p>
                <p className="font-ui text-micro text-text-tertiary">
                  Wides, no-balls, byes and leg-byes are recorded either way.
                </p>
              </div>
              <Toggle
                checked={extrasCount}
                onChange={setExtrasCount}
                label="Extras count toward the score"
                testID="extras-count-toggle"
              />
            </div>
            {error && (
              <p
                role="alert"
                data-testid="scoring-error-msg"
                className="mt-3 font-ui text-body text-brand-red"
              >
                {error}
              </p>
            )}
            <div className="mt-4">
              <Button
                size="lg"
                loading={busy}
                disabled={!started || !battingSide || !allSidesAssigned}
                onClick={startFirstInnings}
                testID="start-innings"
              >
                Start innings
              </Button>
            </div>
          </SetupCard>
        </div>
      </div>
    );
  }

  // Live scoring
  const overBalls = live?.current_over_balls ?? [];
  const legalInOver = overBalls.filter((b) => isLegalDelivery(b.extra_type)).length;
  const emptySlots = Math.max(0, 6 - legalInOver);
  const oversLimit = live?.overs_per_innings ?? room.overs_per_innings;
  const crr = live?.current_run_rate ?? 0;
  const need = innings.target_runs != null ? innings.target_runs - innings.total_runs : null;
  const ballsLeft = oversLimit * 6 - legalBalls;
  const strikerRow = battingRows.find((b) => b.player_id === strikerId);
  const nonStrikerRow = battingRows.find((b) => b.player_id === nonStrikerId);
  const bowlerRow = bowlingRows.find((b) => b.player_id === bowlerId);
  const sheetTitle = (kind: 'striker' | 'nonStriker') =>
    innings.total_wickets === 0
      ? kind === 'striker'
        ? 'Who’s on strike?'
        : 'Who’s at the other end?'
      : 'Who’s coming in?';
  const taken = new Set([strikerId, nonStrikerId].filter(Boolean) as string[]);

  return (
    <div data-testid="scoring-console">
      {header}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Score header */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="relative overflow-hidden rounded-lg bg-brand-red p-6 text-white shadow-[0_18px_44px_rgba(216,0,0,0.3)]"
            data-testid="score-header"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-[200px] w-[200px] rounded-[999px] bg-white/10"
            />
            <p className="relative font-ui text-micro uppercase tracking-[0.16em] text-white/80">
              {teamName(innings.batting_match_team_id)} · Innings {innings.innings_number}
            </p>
            <p
              className="relative mt-1 font-display text-[72px] leading-none tracking-wide"
              data-testid="score-line"
            >
              {innings.total_runs}/{innings.total_wickets}
            </p>
            <p className="relative mt-1 font-ui text-card-title">
              {Number(innings.overs_completed).toFixed(1)} / {oversLimit} ov · CRR {crr.toFixed(2)}
              {live?.required_run_rate != null && ` · RRR ${live.required_run_rate.toFixed(2)}`}
            </p>
            {need != null && inProgress && (
              <p
                className="relative mt-2 inline-block rounded-md bg-white/15 px-3 py-1 font-ui text-body font-semibold"
                data-testid="need-line"
              >
                Need {Math.max(need, 0)} from {Math.max(ballsLeft, 0)} balls
              </p>
            )}

            <div className="relative mt-5 flex items-center gap-2" data-testid="over-balls">
              <span className="mr-2 font-ui text-micro uppercase tracking-wide text-white/80">
                This over · {overRuns(overBalls)} runs
              </span>
              {overBalls.map((b, i) => (
                <motion.span
                  key={`${i}-${b.runs_scored}-${b.extra_type}-${b.is_wicket}`}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                  className="grid h-[34px] min-w-[34px] place-items-center rounded-[999px] px-2 font-ui text-[13px] font-bold text-white"
                  style={{ backgroundColor: ballColor(b) }}
                >
                  {ballLabel(b)}
                </motion.span>
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <span
                  key={`e${i}`}
                  className="h-[34px] w-[34px] rounded-[999px] border-2 border-dashed border-white/40"
                />
              ))}
            </div>
          </motion.section>

          {/* Innings over */}
          {!inProgress && (
            <section
              className="rounded-lg border border-border-subtle bg-surface p-6"
              data-testid="innings-complete"
            >
              <p className="flex items-center gap-2 font-ui text-card-title font-bold text-ink-black">
                <Flag className="h-[20px] w-[20px] text-brand-red" />
                Innings complete
              </p>
              <p className="mt-1 font-ui text-body text-text-secondary">
                {completionReason(innings, live?.overs_per_innings)}
              </p>
              {error && (
                <p role="alert" className="mt-3 font-ui text-body text-brand-red">
                  {error}
                </p>
              )}
              <div className="mt-4 flex gap-3">
                {innings.innings_number < 2 && (
                  <Button loading={busy} onClick={startNextInnings} testID="start-next-innings">
                    Start innings {innings.innings_number + 1}
                  </Button>
                )}
                <Button
                  variant={innings.innings_number < 2 ? 'secondary' : 'primary'}
                  loading={busy}
                  onClick={() => setConfirmFinish(true)}
                  icon={Trophy}
                  testID="finish-match"
                >
                  Finish match
                </Button>
                <Button
                  variant="soft"
                  icon={Undo2}
                  onClick={undo}
                  disabled={busy}
                  testID="undo-ball"
                >
                  Undo last ball
                </Button>
              </div>
            </section>
          )}

          {/* Run pad */}
          {inProgress && (
            <section
              className="rounded-lg border border-border-subtle bg-surface p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
              data-testid="run-pad"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 font-ui text-micro uppercase tracking-wide text-text-secondary">
                  Extra
                </span>
                {EXTRAS.map((x) => (
                  <ChoiceChip
                    key={x.kind}
                    active={pendingExtra === x.kind}
                    onClick={() => setPendingExtra(pendingExtra === x.kind ? null : x.kind)}
                    testID={`extra-${x.kind}`}
                  >
                    {x.label}
                  </ChoiceChip>
                ))}
                {pendingExtra && (
                  <span className="font-ui text-micro text-text-tertiary">
                    Now tap the runs scored off it (0 = none).
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <motion.button
                    key={n}
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    whileHover={canScore ? { y: -2 } : undefined}
                    disabled={!canScore}
                    onClick={() => pressRun(n)}
                    data-testid={`run-${n}`}
                    aria-label={`${n} run${n === 1 ? '' : 's'}`}
                    className={`h-[84px] rounded-lg font-display text-[40px] cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      n === 4
                        ? 'bg-status-success-bg text-status-success hover:bg-status-success hover:text-white'
                        : n === 6
                          ? 'bg-ink-black text-white hover:bg-brand-red'
                          : 'bg-ink-black/[0.05] text-ink-black hover:bg-ink-black/[0.1]'
                    }`}
                  >
                    {n}
                  </motion.button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setSheet('wicket')}
                  disabled={!canScore}
                  testID="wicket-button"
                >
                  Wicket
                </Button>
                <Button
                  variant="soft"
                  icon={Undo2}
                  onClick={undo}
                  disabled={busy}
                  testID="undo-ball"
                >
                  Undo
                </Button>
                {!singleBatter && (
                  <Button
                    variant="soft"
                    icon={ArrowLeftRight}
                    onClick={swapStrike}
                    disabled={!canScore}
                    testID="swap-strike"
                  >
                    Swap strike
                  </Button>
                )}
                {innings.innings_number < 2 ? (
                  <Button
                    variant="ghost"
                    icon={RotateCcw}
                    onClick={() => setConfirmEnd(true)}
                    disabled={busy}
                    testID="end-innings"
                  >
                    End innings
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    icon={Trophy}
                    onClick={() => setConfirmFinish(true)}
                    disabled={busy}
                    testID="finish-early"
                  >
                    Finish match
                  </Button>
                )}
              </div>
              <p className="mt-3 font-ui text-micro text-text-tertiary">
                Shortcuts: 0–6 runs · W wicket · U undo · X swap strike
              </p>
              {error && (
                <p
                  role="alert"
                  data-testid="scoring-error-msg"
                  className="mt-3 font-ui text-body text-brand-red"
                >
                  {error}
                </p>
              )}
            </section>
          )}
        </div>

        {/* Crease */}
        <aside className="space-y-4" data-testid="crease-panel">
          <CreaseCard
            label="Striker"
            testID="striker-card"
            name={playerName(strikerId)}
            detail={
              strikerRow
                ? `${strikerRow.runs} (${strikerRow.balls}) · ${strikerRow.fours}×4 ${strikerRow.sixes}×6`
                : undefined
            }
            onClick={() => inProgress && setSheet('striker')}
            highlight
          />
          {!singleBatter && (
            <CreaseCard
              label="Non-striker"
              testID="non-striker-card"
              name={playerName(nonStrikerId)}
              detail={nonStrikerRow ? `${nonStrikerRow.runs} (${nonStrikerRow.balls})` : undefined}
              onClick={() => inProgress && setSheet('nonStriker')}
            />
          )}
          <CreaseCard
            label="Bowler"
            testID="bowler-card"
            name={playerName(bowlerId)}
            detail={
              bowlerRow
                ? `${bowlerRow.overs} ov · ${bowlerRow.runs_conceded} runs · ${bowlerRow.wickets} wkts`
                : undefined
            }
            onClick={() => inProgress && setSheet('bowler')}
          />

          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <p className="mb-2 font-ui text-micro uppercase tracking-wide text-text-secondary">
              Batting card
            </p>
            <ul className="space-y-1" data-testid="batting-card">
              {battingRows.map((b) => (
                <li
                  key={b.player_id}
                  className="flex items-center justify-between font-ui text-body"
                >
                  <span className={b.out ? 'text-text-tertiary line-through' : 'text-ink-black'}>
                    {nameOf(b)}
                  </span>
                  <span className="text-text-secondary">
                    {b.runs} ({b.balls})
                  </span>
                </li>
              ))}
              {battingRows.length === 0 && (
                <li className="font-ui text-body text-text-tertiary">
                  No one has faced a ball yet.
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      {/* Pickers */}
      <Drawer
        open={sheet === 'striker' || sheet === 'nonStriker'}
        onClose={() => setSheet(null)}
        title={sheet === 'nonStriker' ? sheetTitle('nonStriker') : sheetTitle('striker')}
        subtitle={teamName(innings.batting_match_team_id)}
        width={440}
        testID="batter-picker"
      >
        <PickerList
          options={battingOptions.filter(
            (o) =>
              !taken.has(o.value) || o.value === (sheet === 'striker' ? strikerId : nonStrikerId),
          )}
          selected={sheet === 'striker' ? strikerId : nonStrikerId}
          onPick={(id) => {
            if (sheet === 'striker') {
              setStrikerId(id);
              afterPick({ striker: id });
            } else {
              setNonStrikerId(id);
              afterPick({ nonStriker: id });
            }
          }}
        />
      </Drawer>

      <Drawer
        open={sheet === 'bowler'}
        onClose={() => setSheet(null)}
        title="Who’s bowling?"
        subtitle={teamName(innings.bowling_match_team_id)}
        width={440}
        testID="bowler-picker"
      >
        <PickerList
          options={bowlingOptions}
          selected={bowlerId}
          flagged={prevBowlerId}
          flagLabel="Bowled last over"
          onPick={(id) => {
            setBowlerId(id);
            afterPick({ bowler: id });
          }}
        />
      </Drawer>

      <Drawer
        open={sheet === 'wicket'}
        onClose={() => setSheet(null)}
        title="How was the batter out?"
        width={420}
        testID="wicket-picker"
      >
        <div className="grid grid-cols-2 gap-3">
          {WICKET_TYPES.map((w) => (
            <Button
              key={w.value}
              variant="soft"
              size="lg"
              onClick={() => chooseWicket(w.value)}
              testID={`wicket-${w.value}`}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </Drawer>

      <Drawer
        open={sheet === 'runOut'}
        onClose={() => setSheet(null)}
        title="Who was run out?"
        width={420}
        testID="runout-picker"
      >
        <div className="grid gap-3">
          {[strikerId, nonStrikerId]
            .filter((id): id is string => !!id)
            .map((id) => (
              <Button
                key={id}
                variant="soft"
                size="lg"
                onClick={() => confirmRunOut(id)}
                testID={`runout-${id}`}
              >
                {playerName(id)}
                {id === strikerId ? ' (striker)' : ' (non-striker)'}
              </Button>
            ))}
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmEnd}
        title="End this innings now?"
        message="The innings will close at the current score and the other team will bat next."
        confirmLabel="End innings"
        onConfirm={() => {
          setConfirmEnd(false);
          startNextInnings();
        }}
        onCancel={() => setConfirmEnd(false)}
        testID="end-innings-dialog"
      />
      <ConfirmDialog
        open={confirmFinish}
        title="Finish the match?"
        message="The result is worked out from the scorecard and players are notified. This can’t be undone."
        confirmLabel="Finish match"
        onConfirm={() => {
          setConfirmFinish(false);
          finishMatch();
        }}
        onCancel={() => setConfirmFinish(false)}
        testID="finish-dialog"
      />
    </div>
  );
}

function SetupCard({
  step,
  title,
  done = false,
  disabled = false,
  children,
}: {
  step: number;
  title: string;
  done?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border bg-surface p-5 transition-opacity ${
        done ? 'border-status-success/40' : 'border-border-subtle'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <p className="mb-3 flex items-center gap-3 font-ui text-card-title font-bold text-ink-black">
        <span
          className={`grid h-[28px] w-[28px] place-items-center rounded-[999px] text-[13px] text-white ${
            done ? 'bg-status-success' : 'bg-brand-red'
          }`}
        >
          {done ? '✓' : step}
        </span>
        {title}
      </p>
      {children}
    </section>
  );
}

function ChoiceChip({
  active,
  onClick,
  children,
  testID,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testID}
      className={`h-[40px] rounded-md px-4 font-ui text-[13px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
        active
          ? 'bg-brand-red text-white shadow-[0_6px_18px_rgba(216,0,0,0.28)]'
          : 'bg-ink-black/[0.05] text-ink-black hover:bg-ink-black/[0.1]'
      }`}
    >
      {children}
    </button>
  );
}

function CreaseCard({
  label,
  name,
  detail,
  onClick,
  highlight = false,
  testID,
}: {
  label: string;
  name: string;
  detail?: string;
  onClick: () => void;
  highlight?: boolean;
  testID: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`w-full rounded-lg border bg-surface p-4 text-left cursor-pointer transition-shadow hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] ${
        highlight ? 'border-brand-red/40' : 'border-border-subtle'
      }`}
    >
      <p className="font-ui text-micro uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 font-ui text-card-title font-bold text-ink-black">
        {name || <span className="text-brand-red">Tap to choose</span>}
      </p>
      {detail && <p className="font-ui text-body text-text-tertiary">{detail}</p>}
    </button>
  );
}

function PickerList({
  options,
  selected,
  flagged,
  flagLabel,
  onPick,
}: {
  options: { value: string; label: string }[];
  selected: string | null;
  flagged?: string | null;
  flagLabel?: string;
  onPick: (id: string) => void;
}) {
  if (options.length === 0) {
    return <p className="font-ui text-body text-text-tertiary">No players available.</p>;
  }
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              onClick={() => onPick(o.value)}
              data-testid={`pick-${o.value}`}
              className={`flex w-full items-center justify-between rounded-md border px-4 h-[48px] text-left font-ui text-body font-semibold cursor-pointer transition-colors ${
                selected === o.value
                  ? 'border-brand-red bg-brand-red/5 text-brand-red'
                  : 'border-border-subtle bg-surface text-ink-black hover:border-brand-red/50'
              }`}
            >
              {o.label}
              {flagged === o.value && flagLabel && (
                <span className="font-ui text-micro uppercase text-text-tertiary">{flagLabel}</span>
              )}
            </button>
          </li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
