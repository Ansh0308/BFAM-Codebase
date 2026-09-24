import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  matchTeamLabel,
  type BattingRow,
  type BowlingRow,
  type ExtraType,
  type GameRoom,
  type Innings,
  type IntroMatchTeam,
  type LiveScore,
  type WicketType,
} from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ToggleRow } from '../../../../src/components/ToggleRow';
import { BallOutcomeFlash, type BallOutcome } from '../../../../src/components/BallOutcomeFlash';
import { ScoringSheet, SheetOption } from '../../../../src/components/ScoringSheet';
import { playTriggerSound } from '../../../../src/lib/sounds';
import {
  advanceCrease,
  ballColor,
  ballLabel,
  isLegalDelivery,
  legalBallsFromOvers,
  overRuns,
  restoreCrease,
} from '../../../../src/lib/crease';

// Scoring Interface (PRD §12.18 requirement 2) — rebuilt (see
// .claude/MATCH_REVAMP_PLAN.md): a red score header with this over's balls,
// a big run pad, one-tap wicket types, and quick sheets that ask for the
// right person at the right moment (openers, "who's coming in?" after a
// wicket, the next bowler at the end of an over). Single-batter (box
// cricket) mode drops the non-striker and strike rotation entirely.
// Organizer/scorer only — the backend re-enforces Scorer Selection
// (module §12.19) regardless of what this screen shows.

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
const EXTRAS: { kind: ExtraKind; label: string }[] = [
  { kind: 'WIDE', label: 'wd' },
  { kind: 'NO_BALL', label: 'nb' },
  { kind: 'LEG_BYE', label: 'lb' },
  { kind: 'BYE', label: 'b' },
];
type SheetKind = 'striker' | 'nonStriker' | 'bowler' | 'wicket' | 'moreRuns' | null;

// Backlog A-9: shows the player's real name where they've set one — not
// everyone playing together knows each other's BFAM ID.
function displayName(p: { full_name?: string | null; bfam_id?: string }): string {
  return p.full_name || p.bfam_id || '';
}

// Backlog A-19: a COMPLETED innings can end for any of three reasons (target
// chased, overs used up, or all out) — checked in that order since a chased
// target is the most conclusive reason to show.
function inningsCompletionReason(innings: Innings, oversPerInnings: number | undefined): string {
  if (innings.target_runs != null && innings.total_runs >= innings.target_runs) {
    return `Target chased — ${innings.total_runs}/${innings.total_wickets}`;
  }
  if (oversPerInnings != null && innings.overs_completed >= oversPerInnings) {
    return `Overs complete — ${innings.total_runs}/${innings.total_wickets}`;
  }
  return `All out — ${innings.total_wickets} wickets down`;
}

export default function ScoringInterfaceScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [live, setLive] = useState<LiveScore | null>(null);
  const [battingRows, setBattingRows] = useState<BattingRow[]>([]);
  const [bowlingRows, setBowlingRows] = useState<BowlingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  // Who bowled the over that just finished, flagged in the bowler picker.
  const [prevBowlerId, setPrevBowlerId] = useState<string | null>(null);

  const [pendingExtra, setPendingExtra] = useState<ExtraKind | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  // Run-out is the only wicket where the non-striker can be the one out.
  const [runOutPending, setRunOutPending] = useState(false);
  // Everyone already out this innings, from the scorecard's own `out` flag
  // (recomputed on every load, so it's right after reopening the screen too).
  const [dismissedPlayerIds, setDismissedPlayerIds] = useState<Set<string>>(new Set());

  const [battingSide, setBattingSide] = useState<string | null>(null);
  const [bowlingSide, setBowlingSide] = useState<string | null>(null);
  // Legacy fallback only: matches created before Match Setup existed can still
  // have players without a side (see startInnings).
  const [legacySides, setLegacySides] = useState<boolean | null>(null);
  const [extrasCountTowardScore, setExtrasCountTowardScore] = useState(true);
  const [sideAssignments, setSideAssignments] = useState<Record<string, string>>({});

  const [flashOutcome, setFlashOutcome] = useState<BallOutcome>(null);
  const restoredFor = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gameRoom, intro, liveScore, scorecard] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
        apiClient.getLiveScore(matchId),
        apiClient.getScorecard(matchId).catch(() => null),
      ]);
      setRoom(gameRoom);
      setMatchTeams(intro?.matchTeams ?? gameRoom.match_teams ?? []);
      setLive(liveScore);
      if (intro) setMusicEnabled(intro.intro.background_music_enabled);

      // The toss already decided who bats and who bowls — pre-fill (never
      // overriding a choice already made) until the first innings exists.
      if (
        intro?.intro.toss_winner_match_team_id &&
        intro.intro.toss_decision &&
        !liveScore.innings
      ) {
        const winnerId = intro.intro.toss_winner_match_team_id;
        const otherId =
          intro.matchTeams.find((t) => t.match_team_id !== winnerId)?.match_team_id ?? null;
        setBattingSide(
          (prev) => prev ?? (intro.intro.toss_decision === 'BAT' ? winnerId : otherId),
        );
        setBowlingSide(
          (prev) => prev ?? (intro.intro.toss_decision === 'BAT' ? otherId : winnerId),
        );
      }
      if (scorecard) setExtrasCountTowardScore(scorecard.extras_count_toward_score);
      const card = scorecard?.innings.find((i) => i.innings_id === liveScore.innings?.innings_id);
      setBattingRows(card?.batting ?? []);
      setBowlingRows(card?.bowling ?? []);
      setDismissedPlayerIds(
        new Set(card?.batting.filter((b) => b.out).map((b) => b.player_id) ?? []),
      );
      setSideAssignments((prev) => {
        const next = { ...prev };
        for (const p of gameRoom.players) {
          if (p.match_team_id && !next[p.player_id]) next[p.player_id] = p.match_team_id;
        }
        return next;
      });

      // First time we see this innings on this device: rebuild the crease
      // from the last recorded ball instead of asking again.
      const inn = liveScore.innings;
      if (inn && !restoredFor.current.has(inn.innings_id)) {
        restoredFor.current.add(inn.innings_id);
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
    } catch {
      setError('Could not load scoring data.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const singleBatter = live?.no_non_striker ?? room?.no_non_striker ?? false;

  // Feedback: scoring shouldn't be blocked on who tapped Confirm in the app —
  // only a player who explicitly said they can't play is excluded.
  const eligiblePlayers = room?.players.filter((p) => p.invitation_status !== 'CANT_PLAY') ?? [];
  const allSidesAssigned =
    eligiblePlayers.length > 0 && eligiblePlayers.every((p) => sideAssignments[p.player_id]);

  // Only a match that skipped Match Setup still needs sides picked here.
  useEffect(() => {
    if (!loading && legacySides === null && room) setLegacySides(!allSidesAssigned);
  }, [loading, legacySides, room, allSidesAssigned]);

  function optionsForSide(matchTeamId: string | null) {
    return eligiblePlayers
      .filter((p) => {
        const assigned = sideAssignments[p.player_id] ?? p.match_team_id;
        return !assigned || !matchTeamId || assigned === matchTeamId;
      })
      .map((p) => ({ value: p.player_id, label: displayName(p) }));
  }
  const allOptions = eligiblePlayers.map((p) => ({ value: p.player_id, label: displayName(p) }));
  const innings = live?.innings ?? null;
  const battingOptions = (
    innings ? optionsForSide(innings.batting_match_team_id) : allOptions
  ).filter((o) => !dismissedPlayerIds.has(o.value));
  const bowlingOptions = innings ? optionsForSide(innings.bowling_match_team_id) : allOptions;
  const nameOfPlayer = (id: string | null) =>
    id ? (allOptions.find((o) => o.value === id)?.label ?? null) : null;

  const teamNameFor = (matchTeamId: string | null | undefined) => {
    const t = matchTeams.find((m) => m.match_team_id === matchTeamId);
    return t ? matchTeamLabel(t) : 'Batting';
  };

  const inProgress = innings?.innings_status === 'IN_PROGRESS';
  const legalBalls = innings ? legalBallsFromOvers(Number(innings.overs_completed)) : 0;
  const overNumber = Math.floor(legalBalls / 6);
  const canScore =
    inProgress && !busy && !!strikerId && !!bowlerId && (singleBatter || !!nonStrikerId);

  // What still needs picking, in the order the scorer needs it. `o` lets the
  // caller pass a value it just set (state updates are async).
  function missingPick(
    o: { striker?: string | null; nonStriker?: string | null; bowler?: string | null } = {},
  ) {
    const s = 'striker' in o ? o.striker : strikerId;
    const n = 'nonStriker' in o ? o.nonStriker : nonStrikerId;
    const b = 'bowler' in o ? o.bowler : bowlerId;
    if (!s) return 'striker' as const;
    if (!singleBatter && !n) return 'nonStriker' as const;
    if (!b) return 'bowler' as const;
    return null;
  }

  // Ask for whoever is missing at the moments that matter — a new innings, a
  // wicket, a new over. Keyed on those events (not on every render) so a
  // sheet the scorer closes doesn't pop straight back up.
  const promptKey = `${innings?.innings_id}-${innings?.total_wickets}-${overNumber}`;
  useEffect(() => {
    if (loading || !inProgress || sheet) return;
    const missing = missingPick();
    if (!missing) return;
    // A lone remaining batter walks in without asking.
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
  }, [promptKey, loading]);

  function afterPick(o: Parameters<typeof missingPick>[0]) {
    setSheet(missingPick(o));
  }
  function pickStriker(id: string) {
    setStrikerId(id);
    afterPick({ striker: id });
  }
  function pickNonStriker(id: string) {
    setNonStrikerId(id);
    afterPick({ nonStriker: id });
  }
  function pickBowler(id: string) {
    setBowlerId(id);
    afterPick({ bowler: id });
  }

  function swapStrike() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  async function startInnings() {
    if (!battingSide || !bowlingSide) return;
    setBusy(true);
    setError(null);
    try {
      if (legacySides) {
        const assignments = eligiblePlayers
          .filter((p) => sideAssignments[p.player_id])
          .map((p) => ({ player_id: p.player_id, match_team_id: sideAssignments[p.player_id] }));
        if (assignments.length > 0) await apiClient.assignPlayerSides(matchId, assignments);
        if (!live?.innings) {
          await apiClient.setExtrasCountTowardScore(matchId, extrasCountTowardScore);
        }
      }
      await apiClient.startInnings(matchId, {
        innings_number: (live?.innings ? live.innings.innings_number : 0) + 1,
        batting_match_team_id: battingSide,
        bowling_match_team_id: bowlingSide,
        target_runs: null,
      });
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the innings.');
    } finally {
      setBusy(false);
    }
  }

  async function submitBall(input: {
    runs_scored: number;
    extra_type: ExtraType;
    extra_runs: number;
    is_wicket: boolean;
    wicket_type?: WicketType | null;
    dismissed_player_id?: string | null;
  }) {
    if (!live?.innings || !strikerId || !bowlerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.recordBall(live.innings.innings_id, {
        striker_player_id: strikerId,
        non_striker_player_id: singleBatter ? null : nonStrikerId,
        bowler_player_id: bowlerId,
        ...input,
      });
      if (res.audio_trigger !== 'NONE') {
        playTriggerSound(res.audio_trigger, musicEnabled).catch(() => {});
      }
      if (input.is_wicket) setFlashOutcome('WICKET');
      else if (input.runs_scored === 6) setFlashOutcome('SIX');
      else if (input.runs_scored === 4) setFlashOutcome('FOUR');

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
      setRunOutPending(false);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not record that ball.');
    } finally {
      setBusy(false);
    }
  }

  function pressRun(n: number) {
    setSheet(null);
    if (pendingExtra) {
      const wideOrNoBall = pendingExtra === 'WIDE' || pendingExtra === 'NO_BALL';
      submitBall({
        runs_scored: wideOrNoBall ? 0 : n,
        extra_type: pendingExtra,
        // A wide/no-ball carries an automatic 1, plus whatever was run.
        extra_runs: wideOrNoBall ? 1 + n : n,
        is_wicket: false,
      });
      return;
    }
    submitBall({ runs_scored: n, extra_type: 'NONE', extra_runs: 0, is_wicket: false });
  }

  function chooseWicketType(type: WicketType) {
    // Only a run-out can dismiss the non-striker, so only that asks who.
    if (type === 'RUN_OUT' && !singleBatter && nonStrikerId) {
      setRunOutPending(true);
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
    if (!live?.innings) return;
    setBusy(true);
    try {
      const res = await apiClient.undoBall(live.innings.innings_id);
      // Put the crease back exactly as it was before the undone ball.
      if (res.undone_event) {
        setStrikerId(res.undone_event.striker_player_id);
        setNonStrikerId(singleBatter ? null : res.undone_event.non_striker_player_id);
        setBowlerId(res.undone_event.bowler_player_id);
        setPrevBowlerId(null);
      }
      setPendingExtra(null);
      // A pending "who's bowling next?" / "who's coming in?" prompt belongs
      // to the ball that was just undone.
      setSheet(null);
      setRunOutPending(false);
      await load();
    } catch {
      setError('Nothing to undo.');
    } finally {
      setBusy(false);
    }
  }

  // Ends the current innings and immediately starts the next one with sides
  // swapped and a chase target set from the total just posted.
  async function endInningsAndStartNext() {
    if (!live?.innings) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.startInnings(matchId, {
        innings_number: live.innings.innings_number + 1,
        batting_match_team_id: live.innings.bowling_match_team_id,
        bowling_match_team_id: live.innings.batting_match_team_id,
        target_runs: live.innings.total_runs + 1,
      });
      setStrikerId(null);
      setNonStrikerId(null);
      setBowlerId(null);
      setPrevBowlerId(null);
      // Close whatever picker was open so the new innings' own opening
      // prompts (striker first) appear in the right order.
      setSheet(null);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the next innings.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !room) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="scoring-loading" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.root, styles.center]} testID="scoring-error">
        <Text style={styles.muted}>Could not load this match.</Text>
      </View>
    );
  }

  // ---- Before the first innings: who bats -----------------------------
  if (!live?.innings) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="start-innings-screen">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.startTitle}>Start innings</Text>
          <Text style={styles.startSub}>Who is batting first?</Text>
          {matchTeams.map((t) => {
            const selected = battingSide === t.match_team_id;
            return (
              <Pressable
                key={t.match_team_id}
                onPress={() => {
                  setBattingSide(t.match_team_id);
                  setBowlingSide(
                    matchTeams.find((m) => m.match_team_id !== t.match_team_id)?.match_team_id ??
                      null,
                  );
                }}
                style={[styles.sideCard, selected && styles.sideCardSelected]}
                testID={`batting-side-${t.side_label}`}
              >
                <Feather name="disc" size={20} color={selected ? '#FFFFFF' : '#9A9A9A'} />
                <Text style={styles.sideCardText}>{matchTeamLabel(t)}</Text>
                {selected && <Text style={styles.sideCardTag}>BATS FIRST</Text>}
              </Pressable>
            );
          })}

          {legacySides && (
            <View style={styles.legacyCard} testID="legacy-sides">
              <Text style={styles.legacyTitle}>Assign players to a side</Text>
              {eligiblePlayers.map((p) => (
                <View
                  key={p.player_id}
                  style={styles.legacyRow}
                  testID={`side-assignment-row-${p.player_id}`}
                >
                  <Text style={styles.legacyName}>{displayName(p)}</Text>
                  {matchTeams.map((t) => {
                    const selected = sideAssignments[p.player_id] === t.match_team_id;
                    return (
                      <Pressable
                        key={t.match_team_id}
                        onPress={() =>
                          setSideAssignments((prev) => ({
                            ...prev,
                            [p.player_id]: t.match_team_id,
                          }))
                        }
                        style={[styles.legacyChip, selected && styles.legacyChipSelected]}
                        testID={`assign-${p.player_id}-${t.side_label}`}
                      >
                        <Text style={[styles.legacyChipText, selected && { color: '#FFFFFF' }]}>
                          {matchTeamLabel(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {!allSidesAssigned && (
                <Text style={styles.legacyHint}>
                  Assign every player to a side before starting the innings.
                </Text>
              )}
              <ToggleRow
                label="Extras count toward the score"
                description="Wides, no-balls, byes and leg-byes still get recorded either way."
                value={extrasCountTowardScore}
                onValueChange={setExtrasCountTowardScore}
                testID="extras-count-toggle"
              />
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={startInnings}
            disabled={busy || !battingSide || !allSidesAssigned}
            style={[
              styles.bigButton,
              (busy || !battingSide || !allSidesAssigned) && { opacity: 0.4 },
            ]}
            testID="start-innings-button"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.bigButtonText}>Start Innings</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Live scoring ----------------------------------------------------
  const inn = live.innings;
  const overBalls = live.current_over_balls ?? [];
  const legalInOver = overBalls.filter((b) => isLegalDelivery(b.extra_type)).length;
  const emptySlots = Math.max(0, 6 - legalInOver);
  const oversLimit = live.overs_per_innings ?? room.overs_per_innings;
  const crr = live.current_run_rate ?? 0;
  const need = inn.target_runs != null ? inn.target_runs - inn.total_runs : null;
  const ballsLeft = oversLimit * 6 - legalBalls;
  const strikerRow = battingRows.find((b) => b.player_id === strikerId);
  const nonStrikerRow = battingRows.find((b) => b.player_id === nonStrikerId);
  const bowlerRow = bowlingRows.find((b) => b.player_id === bowlerId);
  const scoreDisabled = !canScore;
  const missing = missingPick();
  const sheetTitle = (kind: 'striker' | 'nonStriker') =>
    inn.total_wickets === 0
      ? kind === 'striker'
        ? "Who's on strike?"
        : "Who's at the other end?"
      : "Who's coming in?";

  return (
    <View style={styles.root} testID="scoring-interface-screen">
      {/* Red score header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="scoring-header-back"
          >
            <Feather name="arrow-left" size={26} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/(tabs)/matches/${matchId}/live`)}
            style={styles.livePill}
            testID="back-to-live"
          >
            <Feather name="radio" size={14} color="#FFFFFF" />
            <Text style={styles.livePillText}>Live view</Text>
          </Pressable>
          <View style={{ width: 26 }} />
        </View>

        <Text style={styles.teamLabel} testID="batting-team-name">
          {teamNameFor(inn.batting_match_team_id).toUpperCase()}
        </Text>
        <View style={styles.scoreRow} testID="score-card">
          <Text style={styles.bigScore}>
            {inn.total_runs}
            <Text style={styles.bigWickets}>/{inn.total_wickets}</Text>
          </Text>
          <View style={styles.oversBox}>
            <Text style={styles.oversValue}>{inn.overs_completed}</Text>
            <View style={styles.oversRule} />
            <Text style={styles.oversLimit}>{oversLimit}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {need != null ? (
              <>
                <Text style={styles.projLabel}>{need > 0 ? 'NEED' : 'TARGET'}</Text>
                <Text style={styles.projValue} testID="chase-need">
                  {need > 0 ? `${need} off ${Math.max(ballsLeft, 0)}` : 'reached'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.projLabel}>PROJECTED</Text>
                <Text style={styles.projValue}>
                  {legalBalls > 0 ? Math.round(crr * oversLimit) : '–'}
                </Text>
              </>
            )}
          </View>
        </View>
        {live.extras_count_toward_score === false && (
          <Text style={styles.extrasNote} testID="extras-excluded-note">
            Extras don&apos;t count toward this score (still recorded)
          </Text>
        )}

        <View style={styles.overStrip} testID="current-over-dots">
          <View style={styles.overStripLabel}>
            <Text style={styles.overStripOvr}>
              OVR {overNumber}.{legalInOver}
            </Text>
            <Text style={styles.overStripRuns}>{overRuns(overBalls)}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bubbles}
          >
            {overBalls.map((b, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  { backgroundColor: ballColor(b), borderColor: ballColor(b) },
                ]}
                testID={`over-ball-${i}`}
              >
                <Text style={styles.bubbleText}>{ballLabel(b)}</Text>
              </View>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <View
                key={`e${i}`}
                style={[styles.bubble, styles.bubbleEmpty]}
                testID={`over-dot-${i}`}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push(`/(tabs)/matches/${matchId}/scorecard`)}
            style={styles.statsPill}
            testID="open-stats"
          >
            <Feather name="bar-chart-2" size={16} color="#0D0D0D" />
            <Text style={styles.statsPillText}>Stats</Text>
          </Pressable>
          <Pressable onPress={undo} disabled={busy} style={styles.undo} testID="undo-button">
            <Feather name="rotate-ccw" size={18} color="#FFFFFF" />
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Who's at the crease / bowling: tap a name to change it. */}
        <View style={styles.crease}>
          <Pressable
            onPress={() => setSheet('striker')}
            style={styles.creaseRow}
            testID="striker-select"
          >
            <View style={[styles.creaseDot, { backgroundColor: colors.brandRed }]} />
            <Text style={styles.creaseName} numberOfLines={1}>
              {nameOfPlayer(strikerId) ?? 'Select striker'}
            </Text>
            <Text style={styles.creaseStat}>
              {strikerRow ? `${strikerRow.runs} (${strikerRow.balls})` : ''}
            </Text>
          </Pressable>
          {!singleBatter && (
            <Pressable
              onPress={() => setSheet('nonStriker')}
              style={styles.creaseRow}
              testID="non-striker-select"
            >
              <View style={[styles.creaseDot, { backgroundColor: '#5A5A5A' }]} />
              <Text style={styles.creaseName} numberOfLines={1}>
                {nameOfPlayer(nonStrikerId) ?? 'Select non-striker'}
              </Text>
              <Text style={styles.creaseStat}>
                {nonStrikerRow ? `${nonStrikerRow.runs} (${nonStrikerRow.balls})` : ''}
              </Text>
              <Pressable
                onPress={swapStrike}
                disabled={!strikerId || !nonStrikerId}
                hitSlop={8}
                style={{ marginLeft: 10, opacity: !strikerId || !nonStrikerId ? 0.3 : 1 }}
                testID="swap-strike-button"
              >
                <Feather name="repeat" size={18} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          )}
          <Pressable
            onPress={() => setSheet('bowler')}
            style={styles.creaseRow}
            testID="bowler-select"
          >
            <Feather name="circle" size={14} color={colors.brandRed} style={{ marginRight: 12 }} />
            <Text style={styles.creaseName} numberOfLines={1}>
              {nameOfPlayer(bowlerId) ?? 'Select bowler'}
            </Text>
            <Text style={styles.creaseStat}>
              {bowlerRow
                ? `${bowlerRow.wickets}-${bowlerRow.runs_conceded} (${bowlerRow.overs})`
                : ''}
            </Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {inn.innings_status === 'COMPLETED' ? (
          // The backend auto-completes an innings for any of three reasons —
          // target chased, overs used up, or everyone out.
          <View style={styles.banner} testID="innings-all-out-banner">
            <Text style={styles.bannerTitle}>
              {inningsCompletionReason(inn, live.overs_per_innings)}
            </Text>
            <Text style={styles.bannerSub}>
              {inn.innings_number === 1
                ? 'This innings is over. Start the next one when you are ready.'
                : 'This innings is over. Finish the match to see the result.'}
            </Text>
          </View>
        ) : (
          <>
            {missing && (
              <Pressable
                onPress={() => setSheet(missing)}
                style={styles.pickBanner}
                testID="pick-players-banner"
              >
                <Feather name="user-plus" size={18} color="#FFFFFF" />
                <Text style={styles.pickBannerText}>
                  {missing === 'bowler' ? 'Pick who is bowling' : 'Pick who is batting'}
                </Text>
              </Pressable>
            )}

            {/* Wicket + extras */}
            <View style={styles.topPad}>
              <Pressable
                onPress={() => setSheet('wicket')}
                disabled={scoreDisabled}
                style={[styles.wicketButton, scoreDisabled && { opacity: 0.4 }]}
                testID="wicket-button"
              >
                <Text style={styles.wicketText}>WKT</Text>
              </Pressable>
              <View style={styles.extrasPanel}>
                <Text style={styles.extrasLabel}>EXTRAS</Text>
                <View style={styles.extrasRow}>
                  {EXTRAS.map((e) => {
                    const armed = pendingExtra === e.kind;
                    return (
                      <Pressable
                        key={e.kind}
                        onPress={() => setPendingExtra((cur) => (cur === e.kind ? null : e.kind))}
                        style={[styles.extraChip, armed && styles.extraChipArmed]}
                        testID={`extra-${e.kind}`}
                      >
                        <Text style={[styles.extraChipText, armed && { color: '#FFFFFF' }]}>
                          {e.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            {pendingExtra && (
              <Text style={styles.armedNote} testID="extra-armed-note">
                {pendingExtra.replace('_', ' ').toLowerCase()} armed — tap the runs scored, or DOT
                for none
              </Text>
            )}

            {/* Run pad */}
            <View style={styles.pad}>
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => pressRun(n)}
                  disabled={scoreDisabled}
                  style={[
                    styles.padButton,
                    n === 4 && { borderColor: '#2E9E4F' },
                    n === 6 && { borderColor: '#7B2CBF' },
                    scoreDisabled && { opacity: 0.4 },
                  ]}
                  testID={`run-${n}`}
                >
                  <Text style={[styles.padText, n === 0 && { fontSize: 22 }]}>
                    {n === 0 ? 'DOT' : n}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setSheet('moreRuns')}
                disabled={scoreDisabled}
                style={[styles.padButton, scoreDisabled && { opacity: 0.4 }]}
                testID="more-runs-button"
              >
                <Feather name="more-horizontal" size={28} color="#FFFFFF" />
              </Pressable>
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          {inn.innings_number === 1 && (
            <Pressable
              onPress={endInningsAndStartNext}
              disabled={busy}
              style={inn.innings_status === 'COMPLETED' ? styles.bigButton : styles.linkButton}
              testID="end-innings-button"
            >
              <Text
                style={inn.innings_status === 'COMPLETED' ? styles.bigButtonText : styles.linkText}
              >
                {inn.innings_status === 'COMPLETED' ? 'Start 2nd Innings' : 'All out? End innings'}
              </Text>
            </Pressable>
          )}
          {inn.innings_number >= 2 && (
            <Pressable
              onPress={() => router.push(`/(tabs)/matches/${matchId}/result`)}
              style={inn.innings_status === 'COMPLETED' ? styles.bigButton : styles.linkButton}
              testID="finish-match-button"
            >
              <Text
                style={inn.innings_status === 'COMPLETED' ? styles.bigButtonText : styles.linkText}
              >
                Finish Match
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Pickers */}
      <ScoringSheet
        visible={sheet === 'striker'}
        title={sheetTitle('striker')}
        subtitle="Batting"
        onClose={() => setSheet(null)}
        testID="sheet-striker"
      >
        {battingOptions
          .filter((o) => o.value !== nonStrikerId)
          .map((o) => (
            <SheetOption
              key={o.value}
              label={o.label}
              selected={o.value === strikerId}
              onPress={() => pickStriker(o.value)}
              testID={`striker-select-options-${o.value}`}
            />
          ))}
      </ScoringSheet>
      <ScoringSheet
        visible={sheet === 'nonStriker'}
        title={sheetTitle('nonStriker')}
        subtitle="Batting"
        onClose={() => setSheet(null)}
        testID="sheet-nonStriker"
      >
        {battingOptions
          .filter((o) => o.value !== strikerId)
          .map((o) => (
            <SheetOption
              key={o.value}
              label={o.label}
              selected={o.value === nonStrikerId}
              onPress={() => pickNonStriker(o.value)}
              testID={`non-striker-select-options-${o.value}`}
            />
          ))}
      </ScoringSheet>
      <ScoringSheet
        visible={sheet === 'bowler'}
        title="Who's bowling?"
        subtitle={overNumber > 0 ? `Over ${overNumber + 1}` : 'Opening over'}
        onClose={() => setSheet(null)}
        testID="sheet-bowler"
      >
        {bowlingOptions.map((o) => (
          <SheetOption
            key={o.value}
            label={o.label}
            sub={o.value === prevBowlerId ? 'Bowled the last over' : undefined}
            selected={o.value === bowlerId}
            onPress={() => pickBowler(o.value)}
            testID={`bowler-select-options-${o.value}`}
          />
        ))}
      </ScoringSheet>
      <ScoringSheet
        visible={sheet === 'wicket'}
        title={runOutPending ? 'Who is run out?' : 'How was the batter out?'}
        onClose={() => {
          setSheet(null);
          setRunOutPending(false);
        }}
        testID="sheet-wicket"
      >
        {runOutPending
          ? [strikerId, nonStrikerId]
              .filter((id): id is string => Boolean(id))
              .map((id) => (
                <SheetOption
                  key={id}
                  label={nameOfPlayer(id) ?? ''}
                  sub={id === strikerId ? 'Striker' : 'Non-striker'}
                  onPress={() => confirmRunOut(id)}
                  testID={`run-out-dismissed-${id}`}
                />
              ))
          : WICKET_TYPES.map((wt) => (
              <SheetOption
                key={wt.value}
                label={wt.label}
                onPress={() => chooseWicketType(wt.value)}
                testID={`wicket-type-${wt.value}`}
              />
            ))}
      </ScoringSheet>
      <ScoringSheet
        visible={sheet === 'moreRuns'}
        title="Runs off this ball"
        subtitle="Overthrows or gully rules"
        onClose={() => setSheet(null)}
        testID="sheet-moreRuns"
      >
        <View style={styles.moreRunsGrid}>
          {[7, 8, 9, 10, 11, 12].map((n) => (
            <Pressable
              key={n}
              onPress={() => pressRun(n)}
              style={styles.moreRunsButton}
              testID={`run-${n}`}
            >
              <Text style={styles.padText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </ScoringSheet>

      <BallOutcomeFlash outcome={flashOutcome} onDone={() => setFlashOutcome(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: 'Inter', fontSize: 15, color: '#9A9A9A' },
  error: { fontFamily: 'Inter', fontSize: 14, color: '#FF6B6B', textAlign: 'center', margin: 12 },

  // Start innings
  startTitle: { fontFamily: 'Inter-Bold', fontSize: 28, color: '#FFFFFF', marginTop: 8 },
  startSub: { fontFamily: 'Inter', fontSize: 15, color: '#9A9A9A', marginTop: 4, marginBottom: 16 },
  sideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 18,
    marginBottom: 10,
  },
  sideCardSelected: { borderColor: colors.brandRed, backgroundColor: '#2A1212' },
  sideCardText: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  sideCardTag: { fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 1, color: colors.brandRed },
  legacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  legacyTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#0D0D0D', marginBottom: 8 },
  legacyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  legacyName: { flex: 1, fontFamily: 'Inter', fontSize: 14, color: '#111111' },
  legacyChip: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  legacyChipSelected: { backgroundColor: colors.brandRed, borderColor: colors.brandRed },
  legacyChipText: { fontFamily: 'Inter-Bold', fontSize: 12, color: '#111111' },
  legacyHint: { fontFamily: 'Inter', fontSize: 12, color: '#767676', marginTop: 8 },
  bigButton: {
    backgroundColor: colors.brandRed,
    borderRadius: 30,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  bigButtonText: { fontFamily: 'Inter-Bold', fontSize: 17, color: '#FFFFFF' },
  linkButton: { alignItems: 'center', paddingVertical: 16 },
  linkText: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#B5B5B5',
    textDecorationLine: 'underline',
  },

  // Header
  header: { backgroundColor: colors.brandRed, paddingHorizontal: 18, paddingBottom: 14 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  livePillText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#FFFFFF', marginLeft: 8 },
  teamLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    letterSpacing: 3,
    color: '#FFFFFF',
    marginTop: 14,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  bigScore: { fontFamily: 'Anton', fontSize: 72, color: '#FFFFFF', lineHeight: 84 },
  bigWickets: { fontFamily: 'Anton', fontSize: 44, color: 'rgba(255,255,255,0.6)' },
  oversBox: {
    marginLeft: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 62,
  },
  oversValue: { fontFamily: 'Anton', fontSize: 26, color: '#FFFFFF' },
  oversRule: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginVertical: 2,
  },
  oversLimit: { fontFamily: 'Inter-Bold', fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  projLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.7)',
  },
  projValue: { fontFamily: 'Anton', fontSize: 26, color: '#FFFFFF', marginTop: 2 },
  extrasNote: { fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  overStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginTop: 12,
    paddingVertical: 10,
  },
  overStripLabel: {
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    minWidth: 70,
  },
  overStripOvr: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.75)',
  },
  overStripRuns: { fontFamily: 'Anton', fontSize: 28, color: '#FFFFFF' },
  bubbles: { alignItems: 'center', paddingHorizontal: 12 },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubbleEmpty: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.4)' },
  bubbleText: { fontFamily: 'Inter-Bold', fontSize: 13, color: '#FFFFFF' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsPillText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#0D0D0D', marginLeft: 8 },
  undo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  undoText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFFFFF', marginLeft: 8 },

  // Crease
  crease: { paddingHorizontal: 18, paddingTop: 14 },
  creaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  creaseDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  creaseName: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFFFFF' },
  creaseStat: { fontFamily: 'Inter', fontSize: 14, color: '#B5B5B5', marginLeft: 8 },

  // Controls
  pickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandRed,
    borderRadius: 14,
    marginHorizontal: 18,
    marginTop: 4,
    paddingVertical: 14,
  },
  pickBannerText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFFFFF', marginLeft: 10 },
  topPad: { flexDirection: 'row', paddingHorizontal: 18, marginTop: 12 },
  wicketButton: {
    width: 104,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.brandRed,
    backgroundColor: '#2A1414',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  wicketText: { fontFamily: 'Inter-Bold', fontSize: 24, letterSpacing: 1, color: '#FF5A5A' },
  extrasPanel: { flex: 1, backgroundColor: '#1E1E1E', borderRadius: 18, padding: 12 },
  extrasLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: '#8E8E8E',
    textAlign: 'center',
  },
  extrasRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  extraChip: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraChipArmed: { backgroundColor: colors.brandRed, borderColor: colors.brandRed },
  extraChipText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFFFFF' },
  armedNote: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#E0B25B',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 18,
  },
  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 14 },
  padButton: {
    width: '23%',
    margin: '1%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#3A3A3A',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padText: { fontFamily: 'Inter-Bold', fontSize: 30, color: '#FFFFFF' },
  moreRunsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  moreRunsButton: {
    width: '30%',
    margin: '1.6%',
    aspectRatio: 1.4,
    borderRadius: 16,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: '#3A1414',
    borderRadius: 14,
    marginHorizontal: 18,
    marginTop: 8,
    padding: 16,
  },
  bannerTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FF7A7A' },
  bannerSub: { fontFamily: 'Inter', fontSize: 13, color: '#B5B5B5', marginTop: 4 },
});
