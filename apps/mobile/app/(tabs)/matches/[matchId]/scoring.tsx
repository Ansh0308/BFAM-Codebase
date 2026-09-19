import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { GameRoom, IntroMatchTeam, LiveScore, WicketType } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { ChipSelect } from '../../../../src/components/ChipSelect';
import { TextField } from '../../../../src/components/TextField';
import { ToggleRow } from '../../../../src/components/ToggleRow';
import { BallOutcomeFlash, type BallOutcome } from '../../../../src/components/BallOutcomeFlash';
import { playTriggerSound } from '../../../../src/lib/sounds';

// A ball this over, purely for the "Current Over" dots display — tracked
// locally rather than from the backend (there's no ball-history read
// endpoint), so it resets if this screen is left mid-over and reopened.
// Legal-ball count (everything but a wide/no-ball) is what actually rolls
// over into a new over, matching overs_completed's own definition.
interface OverBall {
  label: string;
  isLegal: boolean;
}

const WICKET_TYPES: WicketType[] = [
  'BOWLED',
  'CAUGHT',
  'RUN_OUT',
  'STUMPED',
  'LBW',
  'HIT_WICKET',
  'RETIRED',
];
type ExtraKind = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';

// Backlog A-9: shows the player's real name where they've set one — not
// everyone playing together knows each other's BFAM ID — falling back to
// the BFAM ID for a player who hasn't set a name yet.
function displayName(p: { full_name?: string | null; bfam_id?: string }): string {
  return p.full_name || p.bfam_id || '';
}

// Striker/Non-Striker/Bowler row: shows who's currently selected and, when
// tapped, expands the same option list ChipSelect always offered — kept
// collapsed by default so three long player lists don't dominate the
// screen, matching the row-card layout of the reference design.
function PlayerPickerRow({
  label,
  icon,
  iconBg,
  iconColor,
  selectedLabel,
  isOpen,
  onToggle,
  options,
  value,
  onChange,
  testID,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  iconBg: string;
  iconColor: string;
  selectedLabel: string | null;
  isOpen: boolean;
  onToggle: () => void;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  testID: string;
}) {
  return (
    <View className="mb-3">
      <Pressable
        onPress={onToggle}
        className={`flex-row items-center rounded-lg border p-3 ${
          isOpen ? 'border-brand-red' : 'border-border-subtle'
        }`}
        style={{ backgroundColor: isOpen ? '#FDEAEA' : colors.surfaceAlt }}
        testID={testID}
      >
        <View
          className="rounded-full items-center justify-center mr-3"
          style={{ width: 40, height: 40, backgroundColor: iconBg }}
        >
          <Feather name={icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="font-ui font-bold text-body text-ink-black">
            {selectedLabel ?? 'Not Selected'}
          </Text>
          <Text className="font-ui text-micro text-text-secondary">
            {selectedLabel ? label : `Select ${label}`}
          </Text>
        </View>
        <Feather name={isOpen ? 'chevron-down' : 'chevron-right'} size={20} color="#9A9A9A" />
      </Pressable>
      {isOpen && (
        <View className="mt-2 pl-1">
          <ChipSelect
            label={`Choose ${label}`}
            options={options}
            value={value}
            onChange={(v) => {
              onChange(v);
              onToggle();
            }}
            testID={`${testID}-options`}
          />
        </View>
      )}
    </View>
  );
}

// Scoring Interface (PRD §12.18 requirement 2). Organizer/scorer only —
// the backend re-enforces Scorer Selection (module §12.19: player- vs
// turf-staff-managed) regardless of what this screen shows.
export default function ScoringInterfaceScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [live, setLive] = useState<LiveScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);

  const [pendingExtra, setPendingExtra] = useState<ExtraKind | null>(null);
  const [pendingWicket, setPendingWicket] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  // A-20: only a RUN_OUT can dismiss either end — every other wicket type
  // is always the striker, so this only needs asking for RUN_OUT.
  const [runOutDismissedId, setRunOutDismissedId] = useState<string | null>(null);
  // A-20: who's already out this innings, so they can't be picked again as
  // striker/non-striker. Derived from the scorecard's own `out` flag (the
  // same batting.out the backend already computes from score_events) on
  // every load rather than tracked separately client-side — that way it's
  // also correct if this screen is closed and reopened mid-innings, not
  // just for wickets taken in this session.
  const [dismissedPlayerIds, setDismissedPlayerIds] = useState<Set<string>>(new Set());

  const [battingSide, setBattingSide] = useState<string | null>(null);
  const [bowlingSide, setBowlingSide] = useState<string | null>(null);
  const [targetRuns, setTargetRuns] = useState<string>('');
  // Backlog A-8: chosen once, before the very first innings — the backend
  // rejects changing it after any innings exists, so this only matters on
  // the pre-first-innings screen below.
  const [extrasCountTowardScore, setExtrasCountTowardScore] = useState(true);
  // Backlog A-10: local edits to each player's side before they're saved —
  // seeded from match_players.match_team_id on load, so re-entering this
  // screen (or a page that assigned sides earlier, e.g. the Playing XI
  // reveal) doesn't lose prior work.
  const [sideAssignments, setSideAssignments] = useState<Record<string, string>>({});

  const [overBalls, setOverBalls] = useState<OverBall[]>([]);
  const legalCountRef = useRef(0);
  // Which of Striker/Non-Striker/Bowler is currently expanded for picking —
  // only one at a time, tap-to-open/tap-to-close instead of always showing
  // all three lists at once.
  const [openPicker, setOpenPicker] = useState<'striker' | 'nonStriker' | 'bowler' | null>(null);
  // A brief celebratory overlay on a boundary or wicket — the exact moment
  // a ball is actually recorded (see BallOutcomeFlash), not tied to sound.
  const [flashOutcome, setFlashOutcome] = useState<BallOutcome>(null);

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
      setMatchTeams(intro?.matchTeams ?? []);
      setLive(liveScore);
      if (intro) setMusicEnabled(intro.intro.background_music_enabled);

      // The toss already decided who bats and who bowls — re-asking here
      // was pure redundant tapping. Pre-fill (never overrides a choice the
      // organizer already made) whenever a toss result exists and the
      // first innings hasn't started yet; a match scored without running
      // the toss step at all still falls back to the manual pickers below.
      if (
        intro?.intro.toss_winner_match_team_id &&
        intro.intro.toss_decision &&
        !liveScore.innings
      ) {
        const winnerId = intro.intro.toss_winner_match_team_id;
        const otherId =
          intro.matchTeams.find((t) => t.match_team_id !== winnerId)?.match_team_id ?? null;
        const battingId = intro.intro.toss_decision === 'BAT' ? winnerId : otherId;
        const bowlingId = intro.intro.toss_decision === 'BAT' ? otherId : winnerId;
        setBattingSide((prev) => prev ?? battingId);
        setBowlingSide((prev) => prev ?? bowlingId);
      }
      if (scorecard) setExtrasCountTowardScore(scorecard.extras_count_toward_score);
      const currentInningsScorecard = scorecard?.innings.find(
        (i) => i.innings_id === liveScore.innings?.innings_id,
      );
      setDismissedPlayerIds(
        new Set(
          currentInningsScorecard?.batting.filter((b) => b.out).map((b) => b.player_id) ?? [],
        ),
      );
      setSideAssignments((prev) => {
        const next = { ...prev };
        for (const p of gameRoom.players) {
          if (p.match_team_id && !next[p.player_id]) next[p.player_id] = p.match_team_id;
        }
        return next;
      });
    } catch {
      setError('Could not load scoring data.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Feedback: scoring shouldn't be blocked on who tapped Confirm in the
  // app — an organizer scores whoever actually showed up. Only a player
  // who explicitly said they can't play is excluded; PENDING/MAYBE/
  // NO_RESPONSE are all still pickable as striker, non-striker, or bowler.
  const eligiblePlayers = room?.players.filter((p) => p.invitation_status !== 'CANT_PLAY') ?? [];
  const allSidesAssigned =
    eligiblePlayers.length > 0 && eligiblePlayers.every((p) => sideAssignments[p.player_id]);

  // Backlog A-10: once sides are assigned, the striker/non-striker pickers
  // only offer the batting side's players and the bowler picker only the
  // bowling side's — a player with no assignment yet (e.g. an older match
  // scored before this feature existed) falls back to appearing in both,
  // so nothing silently disappears for pre-existing matches.
  function optionsForSide(matchTeamId: string | null) {
    return eligiblePlayers
      .filter((p) => {
        const assigned = sideAssignments[p.player_id] ?? p.match_team_id;
        return !assigned || !matchTeamId || assigned === matchTeamId;
      })
      .map((p) => ({ value: p.player_id, label: displayName(p) }));
  }

  const battingOptions = (
    live?.innings
      ? optionsForSide(live.innings.batting_match_team_id)
      : eligiblePlayers.map((p) => ({ value: p.player_id, label: displayName(p) }))
  ).filter((o) => !dismissedPlayerIds.has(o.value));
  const bowlingOptions = live?.innings
    ? optionsForSide(live.innings.bowling_match_team_id)
    : eligiblePlayers.map((p) => ({ value: p.player_id, label: displayName(p) }));

  async function startInnings() {
    if (!battingSide || !bowlingSide) return;
    setBusy(true);
    setError(null);
    try {
      // Only actually needed the first time (subsequent innings reuse the
      // same assignments), but idempotent — safe to send every time.
      const assignments = eligiblePlayers
        .filter((p) => sideAssignments[p.player_id])
        .map((p) => ({ player_id: p.player_id, match_team_id: sideAssignments[p.player_id] }));
      if (assignments.length > 0) {
        await apiClient.assignPlayerSides(matchId, assignments);
      }
      // Only meaningful before the very first innings — the backend
      // rejects this call once any innings exists, so only send it then.
      if (!live?.innings) {
        await apiClient.setExtrasCountTowardScore(matchId, extrasCountTowardScore);
      }
      await apiClient.startInnings(matchId, {
        innings_number: (live?.innings ? live.innings.innings_number : 0) + 1,
        batting_match_team_id: battingSide,
        bowling_match_team_id: bowlingSide,
        target_runs: targetRuns ? Number(targetRuns) : null,
      });
      resetOverBalls();
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the innings.');
    } finally {
      setBusy(false);
    }
  }

  function ballLabel(input: {
    runs_scored: number;
    extra_type: 'NONE' | ExtraKind;
    extra_runs: number;
    is_wicket: boolean;
  }): string {
    if (input.is_wicket) return 'W';
    switch (input.extra_type) {
      case 'WIDE':
        return input.extra_runs > 1 ? `wd+${input.extra_runs - 1}` : 'wd';
      case 'NO_BALL':
        return input.extra_runs > 1 ? `nb+${input.extra_runs - 1}` : 'nb';
      case 'BYE':
        return `${input.extra_runs}b`;
      case 'LEG_BYE':
        return `${input.extra_runs}lb`;
      default:
        return String(input.runs_scored);
    }
  }

  function recordOverBall(input: {
    runs_scored: number;
    extra_type: 'NONE' | ExtraKind;
    extra_runs: number;
    is_wicket: boolean;
  }) {
    const isLegal = input.extra_type !== 'WIDE' && input.extra_type !== 'NO_BALL';
    const label = ballLabel(input);
    setOverBalls((prev) => {
      if (isLegal && legalCountRef.current >= 6) {
        legalCountRef.current = 1;
        return [{ label, isLegal }];
      }
      if (isLegal) legalCountRef.current += 1;
      return [...prev, { label, isLegal }];
    });
  }

  function resetOverBalls() {
    legalCountRef.current = 0;
    setOverBalls([]);
  }

  // One-tap strike swap (feedback A-7: "minimal clicks everywhere") — lets
  // the organizer flip ends without re-picking both players from the chip
  // lists, e.g. after a run-out at the non-striker's end.
  function swapStrike() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  async function submitBall(
    input: {
      runs_scored: number;
      extra_type: 'NONE' | ExtraKind;
      extra_runs: number;
      is_wicket: boolean;
      wicket_type?: WicketType | null;
      dismissed_player_id?: string | null;
    },
    options?: { rotateStrike?: boolean },
  ) {
    if (!live?.innings || !strikerId || !bowlerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.recordBall(live.innings.innings_id, {
        striker_player_id: strikerId,
        non_striker_player_id: nonStrikerId,
        bowler_player_id: bowlerId,
        ...input,
      });
      if (res.audio_trigger !== 'NONE') {
        playTriggerSound(res.audio_trigger, musicEnabled).catch(() => {});
      }
      if (input.is_wicket) setFlashOutcome('WICKET');
      else if (input.runs_scored === 6) setFlashOutcome('SIX');
      else if (input.runs_scored === 4) setFlashOutcome('FOUR');
      // Real-cricket strike rotation, done automatically instead of asking
      // the organizer to tap Swap after every odd-run ball — the single
      // biggest tap-count win in this screen since it fires on ~1 in 3
      // deliveries. A wicket instead clears whichever end was actually
      // dismissed (striker, or — on a RUN_OUT — whichever end the
      // organizer picked below): that batter can't just stay selected, and
      // guessing the incoming one would risk recording the next ball
      // against the wrong player.
      if (input.is_wicket && input.dismissed_player_id) {
        if (input.dismissed_player_id === strikerId) setStrikerId(null);
        if (input.dismissed_player_id === nonStrikerId) setNonStrikerId(null);
      } else if (options?.rotateStrike) {
        swapStrike();
      }
      recordOverBall(input);
      setPendingExtra(null);
      setPendingWicket(false);
      setWicketType(null);
      setRunOutDismissedId(null);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not record that ball.');
    } finally {
      setBusy(false);
    }
  }

  function pressRun(n: number) {
    if (pendingWicket) return; // wicket flow uses its own confirm
    // The batsmen physically cross on an odd number of runs run, whatever
    // the delivery type — n is exactly that count for every button here
    // (the extra runs above wide/no-ball's automatic 1, or the runs
    // themselves for a normal ball/bye/leg-bye).
    const rotateStrike = n % 2 === 1;
    if (pendingExtra) {
      const isWideOrNoBall = pendingExtra === 'WIDE' || pendingExtra === 'NO_BALL';
      submitBall(
        {
          runs_scored: isWideOrNoBall ? 0 : n,
          extra_type: pendingExtra,
          extra_runs: isWideOrNoBall ? 1 + n : n,
          is_wicket: false,
        },
        { rotateStrike },
      );
      return;
    }
    submitBall(
      { runs_scored: n, extra_type: 'NONE', extra_runs: 0, is_wicket: false },
      { rotateStrike },
    );
  }

  // A-20: for every wicket type except RUN_OUT the striker is always the
  // one out — a run-out is the only case where the non-striker could be
  // the one dismissed instead, so that's the only type that asks.
  function confirmWicket() {
    if (!wicketType) return;
    const dismissedId = wicketType === 'RUN_OUT' ? runOutDismissedId : strikerId;
    if (!dismissedId) return;
    submitBall({
      runs_scored: 0,
      extra_type: 'NONE',
      extra_runs: 0,
      is_wicket: true,
      wicket_type: wicketType,
      dismissed_player_id: dismissedId,
    });
  }

  async function undo() {
    if (!live?.innings) return;
    setBusy(true);
    try {
      await apiClient.undoBall(live.innings.innings_id);
      setOverBalls((prev) => {
        const last = prev[prev.length - 1];
        if (last?.isLegal) legalCountRef.current = Math.max(0, legalCountRef.current - 1);
        return prev.slice(0, -1);
      });
      await load();
    } catch {
      setError('Nothing to undo.');
    } finally {
      setBusy(false);
    }
  }

  // Ends the current innings and immediately starts the next one with
  // sides swapped and a chase target set from the total just posted —
  // the standard two-innings limited-overs flow, in one tap instead of a
  // second form.
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
      resetOverBalls();
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the next innings.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="scoring-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="scoring-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            Could not load this match.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!live?.innings) {
    return (
      <ScreenContainer scroll>
        <View className="pt-6" testID="start-innings-screen">
          <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Start Innings</Text>

          {/* Backlog A-10: every confirmed player must be assigned to a
              side before scoring can restrict pickers to the correct
              team — a one-time step for the whole match, done here since
              this screen only appears before the very first innings. */}
          <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
            Assign Players to a Side
          </Text>
          {eligiblePlayers.map((p) => (
            <View
              key={p.player_id}
              className="flex-row items-center justify-between py-2 border-b border-border-subtle"
              testID={`side-assignment-row-${p.player_id}`}
            >
              <Text className="font-ui text-body text-text-primary">{displayName(p)}</Text>
              <View className="flex-row">
                {matchTeams.map((t) => {
                  const selected = sideAssignments[p.player_id] === t.match_team_id;
                  return (
                    <Pressable
                      key={t.match_team_id}
                      onPress={() =>
                        setSideAssignments((prev) => ({ ...prev, [p.player_id]: t.match_team_id }))
                      }
                      className={`rounded-md border px-3 py-1.5 ml-2 ${
                        selected
                          ? 'bg-brand-red border-brand-red'
                          : 'bg-surface border-border-strong'
                      }`}
                      testID={`assign-${p.player_id}-${t.side_label}`}
                    >
                      <Text
                        className={`font-ui text-micro ${selected ? 'text-white font-bold' : 'text-text-primary'}`}
                      >
                        {t.side_label === 'TEAM_A' ? 'Team A' : 'Team B'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {!allSidesAssigned && (
            <Text className="font-ui text-micro text-text-tertiary mt-2 mb-2">
              Assign every player to a side before starting the innings.
            </Text>
          )}

          {/* Backlog A-8: a per-match rule, chosen once before the first
              ball is bowled — extras are always recorded exactly as
              bowled in score_events either way; this only controls
              whether they add to the official team total shown here on
              out. */}
          <ToggleRow
            label="Extras count toward the score"
            description="Wides, no-balls, byes and leg-byes still get recorded either way — this only controls whether they add to the team's official total."
            value={extrasCountTowardScore}
            onValueChange={setExtrasCountTowardScore}
            testID="extras-count-toggle"
          />

          <View className="mt-5">
            <ChipSelect
              label="Batting Side"
              options={matchTeams.map((t) => ({
                value: t.match_team_id,
                label: t.side_label === 'TEAM_A' ? 'Team A' : 'Team B',
              }))}
              value={battingSide}
              onChange={(v) => {
                setBattingSide(v);
                const other = matchTeams.find((t) => t.match_team_id !== v);
                setBowlingSide(other?.match_team_id ?? null);
              }}
              testID="batting-side"
            />
            <TextField
              label="Target Runs (2nd innings only)"
              value={targetRuns}
              onChangeText={setTargetRuns}
              placeholder="Leave blank for 1st innings"
              keyboardType="number-pad"
              testID="target-runs-input"
            />
            {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}
            <Button
              label="Start Innings"
              onPress={startInnings}
              loading={busy}
              disabled={!battingSide || !allSidesAssigned}
              testID="start-innings-button"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const legalOverBalls = overBalls.filter((b) => b.isLegal);

  return (
    <View
      className="flex-1 bg-surface"
      style={{ position: 'relative' }}
      testID="scoring-interface-screen"
    >
      {/* Custom branded header (Design §5's diagonal red motif, compact
          version) — this screen hides the default Stack header so it can
          carry the BFAM mark like the reference layout. */}
      <View
        className="flex-row items-center justify-between px-4"
        style={{ height: 56, overflow: 'hidden', backgroundColor: '#FFFFFF' }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="scoring-header-back"
          >
            <Feather name="chevron-left" size={24} color="#0D0D0D" />
          </Pressable>
          <Text className="font-ui font-bold text-section-header text-ink-black ml-3">Scoring</Text>
        </View>
        <View style={{ width: 120, height: 56 }} pointerEvents="none">
          <View
            style={{
              position: 'absolute',
              right: -40,
              top: -30,
              width: 160,
              height: 130,
              backgroundColor: colors.brandRed,
              transform: [{ rotate: '18deg' }],
            }}
          />
          <Text
            className="font-ui font-bold"
            style={{
              position: 'absolute',
              right: 14,
              top: 17,
              fontSize: 18,
              color: '#FFFFFF',
              letterSpacing: 0.5,
            }}
          >
            BFAM
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="px-6 pt-4">
          {/* Score + Current Over card */}
          <View
            className="rounded-lg flex-row items-center justify-between p-4 mb-5"
            style={{ backgroundColor: colors.surfaceAlt }}
            testID="score-card"
          >
            <View>
              <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-1">
                Score
              </Text>
              <Text className="font-ui font-bold text-title-xl text-ink-black">
                {live.innings.total_runs}/{live.innings.total_wickets}
                <Text className="font-ui text-body text-text-secondary">
                  {' '}
                  ({live.innings.overs_completed} ov)
                </Text>
              </Text>
              {live.extras_count_toward_score === false && (
                <Text
                  className="font-ui text-micro text-text-tertiary mt-1"
                  testID="extras-excluded-note"
                >
                  Extras don&apos;t count toward this score (still recorded)
                </Text>
              )}
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#E0E0E0' }} />
            <View>
              <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
                Current Over
              </Text>
              <View className="flex-row" testID="current-over-dots">
                {Array.from({ length: 6 }).map((_, i) => {
                  const ball = legalOverBalls[i];
                  return (
                    <View
                      key={i}
                      className="rounded-full items-center justify-center ml-1"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: ball ? colors.brandRed : '#E0E0E0',
                      }}
                      testID={`over-dot-${i}`}
                    >
                      <Text
                        className="font-ui font-bold"
                        style={{ fontSize: 11, color: ball ? '#FFFFFF' : '#9A9A9A' }}
                      >
                        {ball ? ball.label : '-'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-ui font-bold text-brand-red text-micro uppercase tracking-wide">
              Striker
            </Text>
            <Pressable
              onPress={swapStrike}
              disabled={!strikerId || !nonStrikerId}
              className="flex-row items-center"
              style={{ opacity: !strikerId || !nonStrikerId ? 0.4 : 1 }}
              testID="swap-strike-button"
            >
              <Feather name="repeat" size={14} color={colors.brandRed} />
              <Text className="font-ui font-bold text-micro text-brand-red ml-1">SWAP</Text>
            </Pressable>
          </View>
          <PlayerPickerRow
            label="Striker"
            icon="disc"
            iconBg={colors.brandRed}
            iconColor="#FFFFFF"
            selectedLabel={
              strikerId ? (battingOptions.find((o) => o.value === strikerId)?.label ?? null) : null
            }
            isOpen={openPicker === 'striker'}
            onToggle={() => setOpenPicker((cur) => (cur === 'striker' ? null : 'striker'))}
            options={battingOptions}
            value={strikerId}
            onChange={setStrikerId}
            testID="striker-select"
          />

          <Text className="font-ui font-bold text-text-secondary text-micro uppercase tracking-wide mb-2">
            Non-Striker
          </Text>
          <PlayerPickerRow
            label="Non-Striker"
            icon="disc"
            iconBg="#E5E5E5"
            iconColor="#767676"
            selectedLabel={
              nonStrikerId
                ? (battingOptions.find((o) => o.value === nonStrikerId)?.label ?? null)
                : null
            }
            isOpen={openPicker === 'nonStriker'}
            onToggle={() => setOpenPicker((cur) => (cur === 'nonStriker' ? null : 'nonStriker'))}
            options={battingOptions}
            value={nonStrikerId}
            onChange={setNonStrikerId}
            testID="non-striker-select"
          />

          <Text className="font-ui font-bold text-text-secondary text-micro uppercase tracking-wide mb-2">
            Bowler
          </Text>
          <PlayerPickerRow
            label="Bowler"
            icon="circle"
            iconBg="#FBDADA"
            iconColor={colors.brandRed}
            selectedLabel={
              bowlerId ? (bowlingOptions.find((o) => o.value === bowlerId)?.label ?? null) : null
            }
            isOpen={openPicker === 'bowler'}
            onToggle={() => setOpenPicker((cur) => (cur === 'bowler' ? null : 'bowler'))}
            options={bowlingOptions}
            value={bowlerId}
            onChange={setBowlerId}
            testID="bowler-select"
          />

          {error && <Text className="text-brand-red text-body mb-3">{error}</Text>}

          {pendingWicket ? (
            <View className="mt-2">
              <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
                Wicket Type
              </Text>
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {WICKET_TYPES.map((wt) => (
                  <Pressable
                    key={wt}
                    onPress={() => {
                      setWicketType(wt);
                      setRunOutDismissedId(null);
                    }}
                    className={`rounded-md border px-3 py-2 m-1 ${wicketType === wt ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'}`}
                    testID={`wicket-type-${wt}`}
                  >
                    <Text
                      className={`font-ui text-body ${wicketType === wt ? 'text-white font-bold' : 'text-text-primary'}`}
                    >
                      {wt.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {wicketType === 'RUN_OUT' && (
                <ChipSelect
                  label="Who's Out?"
                  options={[strikerId, nonStrikerId]
                    .filter((id): id is string => Boolean(id))
                    .map((id) => ({
                      value: id,
                      label: displayName(room?.players.find((p) => p.player_id === id) ?? {}),
                    }))}
                  value={runOutDismissedId}
                  onChange={setRunOutDismissedId}
                  testID="run-out-dismissed-select"
                />
              )}

              <View className="flex-row mt-3">
                <View className="flex-1 mr-2">
                  <Button
                    label="Confirm Wicket"
                    onPress={confirmWicket}
                    disabled={!wicketType || (wicketType === 'RUN_OUT' && !runOutDismissedId)}
                    loading={busy}
                    testID="confirm-wicket"
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => {
                      setPendingWicket(false);
                      setWicketType(null);
                      setRunOutDismissedId(null);
                    }}
                    testID="cancel-wicket"
                  />
                </View>
              </View>
            </View>
          ) : (
            <>
              <Text className="font-ui font-bold text-text-secondary text-micro uppercase tracking-wide mt-3 mb-2">
                Runs
              </Text>
              {pendingExtra && (
                <View className="bg-surface-alt rounded-md p-3 mb-2">
                  <Text className="font-ui text-micro text-text-secondary">
                    {pendingExtra.replace('_', ' ')} armed — tap a run value for additional runs, or
                    0 for none.
                  </Text>
                </View>
              )}
              <View className="flex-row" style={{ marginHorizontal: -4 }}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => pressRun(n)}
                    disabled={busy || !strikerId || !bowlerId}
                    className="flex-1 items-center justify-center rounded-md mx-1"
                    style={{
                      height: 56,
                      backgroundColor: n === 4 ? colors.brandRed : colors.surfaceAlt,
                      opacity: busy || !strikerId || !bowlerId ? 0.5 : 1,
                    }}
                    testID={`run-${n}`}
                  >
                    <Text
                      className="font-ui font-bold text-title-xl"
                      style={{ color: n === 4 ? '#FFFFFF' : '#0D0D0D' }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => pressRun(6)}
                disabled={busy || !strikerId || !bowlerId}
                className="items-center justify-center rounded-md mt-2"
                style={{
                  height: 56,
                  width: '18%',
                  backgroundColor: colors.brandRed,
                  opacity: busy || !strikerId || !bowlerId ? 0.5 : 1,
                }}
                testID="run-6"
              >
                <Text className="font-ui font-bold text-title-xl text-white">6</Text>
              </Pressable>

              <Text className="font-ui font-bold text-text-secondary text-micro uppercase tracking-wide mt-4 mb-2">
                Extras
              </Text>
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {(['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'] as ExtraKind[]).map((kind) => (
                  <Pressable
                    key={kind}
                    onPress={() => setPendingExtra((cur) => (cur === kind ? null : kind))}
                    className={`rounded-md border px-3 py-3 m-1 ${pendingExtra === kind ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'}`}
                    testID={`extra-${kind}`}
                  >
                    <Text
                      className={`font-ui text-body ${pendingExtra === kind ? 'text-white font-bold' : 'text-text-primary'}`}
                    >
                      {kind.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="font-ui font-bold text-text-secondary text-micro uppercase tracking-wide mt-4 mb-2">
                Wicket
              </Text>
              <Pressable
                onPress={() => setPendingWicket(true)}
                disabled={busy || !strikerId || !bowlerId}
                className="rounded-md bg-ink-black flex-row items-center justify-center"
                style={{ height: 52, opacity: busy || !strikerId || !bowlerId ? 0.5 : 1 }}
                testID="wicket-button"
              >
                <Feather name="x-octagon" size={18} color="#FFFFFF" />
                <Text className="font-ui font-bold text-button text-white uppercase tracking-wide ml-2">
                  Wicket
                </Text>
              </Pressable>
            </>
          )}

          <View className="mt-6 mb-10">
            <View className="flex-row" style={{ marginHorizontal: -6 }}>
              <View className="flex-1 mx-1.5">
                <Button
                  label="Undo Last Ball"
                  variant="secondary"
                  iconLeft={<Feather name="rotate-ccw" size={16} color="#0D0D0D" />}
                  onPress={undo}
                  loading={busy}
                  testID="undo-button"
                />
              </View>
              {live.innings.innings_number === 1 && (
                <View className="flex-1 mx-1.5">
                  <Button
                    label="End Innings"
                    variant="secondary"
                    iconLeft={<Feather name="square" size={16} color="#0D0D0D" />}
                    onPress={endInningsAndStartNext}
                    loading={busy}
                    testID="end-innings-button"
                  />
                </View>
              )}
            </View>
            {live.innings.innings_number >= 2 && (
              <View className="mt-3">
                <Button
                  label="Finish Match"
                  onPress={() => router.push(`/(tabs)/matches/${matchId}/result`)}
                  testID="finish-match-button"
                />
              </View>
            )}
            <View className="mt-3">
              <Button
                label="View Live Score"
                iconLeft={<Feather name="bar-chart-2" size={16} color="#FFFFFF" />}
                onPress={() => router.push(`/(tabs)/matches/${matchId}/live`)}
                testID="back-to-live"
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <BallOutcomeFlash outcome={flashOutcome} onDone={() => setFlashOutcome(null)} />
    </View>
  );
}
