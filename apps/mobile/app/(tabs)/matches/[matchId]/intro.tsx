import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { matchTeamLabel, type IntroMatchTeam, type PlayingXiPlayer } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { getSocket, joinMatchRoom, leaveMatchRoom } from '../../../../src/lib/socket';
import { playTriggerSound } from '../../../../src/lib/sounds';
import { useAuthStore } from '../../../../src/store/authStore';

type Stage = 'COUNTDOWN' | 'XI_REVEAL' | 'TOSS' | 'DONE';
const COUNTDOWN_SECONDS = 3;
const XI_REVEAL_MS = 4000;

// Backlog A-9: not everyone playing together knows each other's BFAM ID —
// show the real name where one's been set, falling back to the ID.
function displayName(p: { full_name?: string | null; bfam_id?: string }): string {
  return p.full_name || p.bfam_id || '';
}

// Cinematic Match Countdown Intro (module 2.7, PRD §12.61). Sides are named
// and populated on the Match Setup screen before this sequence starts, so
// every label below uses the team's name, never a bare "Team A/B". Design
// Document §5 calls this out as "the strongest expression of the brand-
// red/black/white system" — full black stage, oversized diagonal red
// geometry, and scoreboard-style typography, more than anywhere else in
// the app. One-time, full-screen sequence: COUNTDOWN -> XI_REVEAL -> TOSS
// -> hands off to Live Scoring (module 2.8, stub only here).
export default function MatchIntroScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // A-26: null until the actual resume point is resolved from the
  // server (see the mount effect below) — starting this at 'COUNTDOWN'
  // unconditionally was the bug: every re-entry (a second Start Match
  // tap, the app backgrounding mid-sequence) began the cinematic
  // sequence from scratch, for this viewer and, via the client's own
  // emitStage call below, for everyone else watching too.
  const [stage, setStage] = useState<Stage | null>(null);
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [players, setPlayers] = useState<PlayingXiPlayer[]>([]);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicAvailable, setMusicAvailable] = useState(false);
  const [tossWinnerSide, setTossWinnerSide] = useState<'TEAM_A' | 'TEAM_B' | null>(null);
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL' | null>(null);
  const [tossRecorded, setTossRecorded] = useState(false);
  // Coin toss, like a real one: a team calls, the coin lands, the caller wins
  // if the call was right.
  const [caller, setCaller] = useState<'TEAM_A' | 'TEAM_B' | null>(null);
  const [call, setCall] = useState<'HEADS' | 'TAILS' | null>(null);
  const [coinOutcome, setCoinOutcome] = useState<'HEADS' | 'TAILS' | null>(null);

  // Backlog A-6 — a playful coin-flip presentation alongside the manual
  // toss that was already here. Either mode ends up calling the exact same
  // submitToss()/recordToss, just deciding tossWinnerSide differently.
  const [tossMode, setTossMode] = useState<'MANUAL' | 'COIN'>('COIN');
  const [flipping, setFlipping] = useState(false);
  const coinRotation = useSharedValue(0);
  const coinAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${coinRotation.value}deg` }],
  }));

  const emittedStages = useRef(new Set<Stage>());

  const teamName = (side: 'TEAM_A' | 'TEAM_B'): string => {
    const t = matchTeams.find((m) => m.side_label === side);
    return t ? matchTeamLabel(t) : matchTeamLabel({ side_label: side, team_name: null });
  };

  const emitStage = useCallback(
    (nextStage: Stage, data: unknown) => {
      if (emittedStages.current.has(nextStage)) return;
      emittedStages.current.add(nextStage);
      getSocket().emit('match:intro_stage', { matchId, stage: nextStage, data });
    },
    [matchId],
  );

  // Mount: figure out whether this device is the organizer/scorer (the
  // "presenter" who drives the sequence and owns the toss-capture form) or
  // a passive viewer (mirrors stage transitions off the socket only —
  // calling the manager-only /start would 403 for them). Either way, join
  // the room so transitions are visible to/from everyone.
  useEffect(() => {
    joinMatchRoom(matchId);

    apiClient
      .getGameRoom(matchId)
      .then(async (room) => {
        const manager =
          room.organizer_id === user?.user_id || room.assigned_scorer_id === user?.user_id;
        setIsOrganizer(manager);
        const contextCall = manager
          ? apiClient.startMatchIntro(matchId)
          : apiClient.getMatchIntro(matchId);
        const [res, live] = await Promise.all([
          contextCall,
          apiClient.getLiveScore(matchId).catch(() => null),
        ]);
        setPlayers(res.players);
        setMatchTeams(res.matchTeams);
        setMusicAvailable(res.intro.background_music_enabled);
        setMusicEnabled(res.intro.background_music_enabled);

        // A-26: resolve the actual resume point from persisted state
        // instead of always beginning at COUNTDOWN.
        if (live?.innings) {
          // Scoring has already started — nothing left for this screen
          // to show at all.
          router.replace(`/(tabs)/matches/${matchId}/scoring`);
          return;
        }
        if (res.intro.toss_completed_at) {
          const winnerTeam = res.matchTeams.find(
            (t) => t.match_team_id === res.intro.toss_winner_match_team_id,
          );
          setTossWinnerSide(winnerTeam?.side_label ?? null);
          setTossDecision(res.intro.toss_decision);
          setTossRecorded(true);
          setStage('TOSS');
        } else if (res.intro.playing_xi_confirmed_team_a && res.intro.playing_xi_confirmed_team_b) {
          // XI reveal is a fixed-length cosmetic animation with nothing
          // persisted to resume mid-way through — once both sides have
          // confirmed it, the next real state to resume at is TOSS.
          setStage('TOSS');
        } else {
          // This really is the first time anyone's opened Intro for this
          // match — only now is it correct to start (and broadcast) the
          // countdown from the top.
          setStage('COUNTDOWN');
          if (manager) {
            playTriggerSound('COUNTDOWN_START', res.intro.background_music_enabled).catch(() => {});
            emitStage('COUNTDOWN', {});
          }
        }
      })
      .catch(() => {});

    const socket = getSocket();
    function onRemoteStage(payload: { matchId: string; stage: Stage; data?: unknown }) {
      if (payload.matchId !== matchId) return;
      if (
        payload.stage === 'XI_REVEAL' &&
        Array.isArray((payload.data as { players?: unknown[] })?.players)
      ) {
        setPlayers((payload.data as { players: PlayingXiPlayer[] }).players);
      }
      setStage(payload.stage);
    }
    socket.on('match:intro_stage', onRemoteStage);

    return () => {
      socket.off('match:intro_stage', onRemoteStage);
      leaveMatchRoom(matchId);
    };
  }, [matchId]);

  // COUNTDOWN: 3 -> 0, presenter-only (a passive viewer just sees a
  // holding state until the XI_REVEAL broadcast arrives — there's no
  // per-tick sync, only per-stage). Plain interval drives the logic/timing
  // (testable, deterministic); Reanimated only drives the decorative pop
  // animation per tick (see CountdownNumber below).
  useEffect(() => {
    if (!isOrganizer || stage !== 'COUNTDOWN') return;
    const interval = setInterval(() => {
      setCount((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOrganizer, stage]);

  useEffect(() => {
    if (!isOrganizer || stage !== 'COUNTDOWN' || count > 0) return;
    setStage('XI_REVEAL');
    emitStage('XI_REVEAL', { players });
  }, [isOrganizer, stage, count, players, emitStage]);

  // XI_REVEAL: shown for a fixed window, then auto-advance to TOSS
  // (presenter drives this transition; viewers mirror it off the socket).
  useEffect(() => {
    if (!isOrganizer || stage !== 'XI_REVEAL') return;
    const timer = setTimeout(() => {
      setStage('TOSS');
      emitStage('TOSS', {});
      playTriggerSound('TOSS', musicEnabled).catch(() => {});
    }, XI_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [isOrganizer, stage, emitStage, musicEnabled]);

  // Decorative spin timed on the JS thread (Reanimated only drives the
  // visual, plain state/timeout drives the logic). The coin's real outcome is
  // random; the caller wins the toss only if their call matches it.
  function flipCoin() {
    if (flipping || !caller || !call) return;
    setFlipping(true);
    setTossWinnerSide(null);
    setCoinOutcome(null);
    const outcome: 'HEADS' | 'TAILS' = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
    const other: 'TEAM_A' | 'TEAM_B' = caller === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';
    coinRotation.value = 0;
    coinRotation.value = withTiming(1800, { duration: 1400, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      setFlipping(false);
      setCoinOutcome(outcome);
      setTossWinnerSide(outcome === call ? caller : other);
    }, 1400);
  }

  function tossAgain() {
    setTossWinnerSide(null);
    setTossDecision(null);
    setCoinOutcome(null);
  }

  async function submitToss(
    winnerSide: 'TEAM_A' | 'TEAM_B' | null = tossWinnerSide,
    decision: 'BAT' | 'BOWL' | null = tossDecision,
  ) {
    if (!winnerSide || !decision) return;
    const winnerMatchTeamId = matchTeams.find((t) => t.side_label === winnerSide)?.match_team_id;
    if (!winnerMatchTeamId) return;
    try {
      await apiClient.recordToss(matchId, winnerMatchTeamId, decision);
    } catch {
      // don't block the sequence on a network hiccup — the result is
      // still shown locally, and the organizer can be the source of
      // truth if a retry is needed.
    }
    setTossWinnerSide(winnerSide);
    setTossDecision(decision);
    setTossRecorded(true);
  }

  async function finish() {
    apiClient.completeMatchIntro(matchId).catch(() => {});
    setStage('DONE');
    router.replace(`/(tabs)/matches/${matchId}/live`);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="match-intro-screen">
      {/* Oversized diagonal red geometry — Design §5's signature motif,
          scaled up and on black for this screen's "strongest expression". */}
      <View style={[styles.shape, styles.shapeTop]} pointerEvents="none" />
      <View style={[styles.shape, styles.shapeBottom]} pointerEvents="none" />

      {musicAvailable && (
        <Pressable
          onPress={() => setMusicEnabled((v) => !v)}
          style={styles.musicToggle}
          testID="music-toggle"
          accessibilityLabel="Toggle background music"
        >
          <Feather name={musicEnabled ? 'volume-2' : 'volume-x'} size={20} color="#FFFFFF" />
        </Pressable>
      )}

      <View style={styles.content} testID="intro-content">
        {stage === null && (
          <Text style={styles.waitingText} testID="intro-resolving">
            Loading…
          </Text>
        )}

        {stage === 'COUNTDOWN' &&
          (isOrganizer ? (
            <CountdownNumber value={count} testID="intro-countdown" />
          ) : (
            <Text style={styles.waitingText} testID="intro-countdown-waiting">
              Get ready — match starting…
            </Text>
          ))}

        {stage === 'XI_REVEAL' &&
          (() => {
            // Feedback: the reveal is only useful split by side, and only
            // by name — nobody recognizes a teammate by BFAM ID. Falls
            // back to one unified list when sides haven't been assigned
            // yet (side_label null for everyone), same as before.
            const teamA = players.filter((p) => p.side_label === 'TEAM_A');
            const teamB = players.filter((p) => p.side_label === 'TEAM_B');
            const unassigned = players.filter((p) => !p.side_label);
            const hasSides = teamA.length > 0 || teamB.length > 0;

            const renderPlayer = (p: PlayingXiPlayer) => (
              <View key={p.player_id} style={styles.xiRow} testID={`xi-player-${p.player_id}`}>
                <Text style={styles.xiPlayerText} numberOfLines={1}>
                  {displayName(p)}
                </Text>
                {p.participant_role === 'CAPTAIN' && <Text style={styles.captainBadge}>C</Text>}
              </View>
            );

            return (
              <View style={styles.xiContainer} testID="intro-xi-reveal">
                <Text style={styles.stageHeader}>PLAYING XI</Text>
                {hasSides ? (
                  <View style={styles.xiTeamsRow}>
                    <View style={styles.xiTeamColumn}>
                      <Text style={styles.xiTeamHeader}>{teamName('TEAM_A').toUpperCase()}</Text>
                      {teamA.map(renderPlayer)}
                    </View>
                    <View style={styles.xiTeamColumn}>
                      <Text style={styles.xiTeamHeader}>{teamName('TEAM_B').toUpperCase()}</Text>
                      {teamB.map(renderPlayer)}
                    </View>
                  </View>
                ) : (
                  <View style={styles.xiColumn}>{unassigned.map(renderPlayer)}</View>
                )}
              </View>
            );
          })()}

        {stage === 'TOSS' && (
          <View style={styles.tossContainer} testID="intro-toss">
            <Text style={styles.stageHeader}>TOSS</Text>
            {!tossRecorded ? (
              isOrganizer ? (
                <View style={styles.tossPanel}>
                  {/* The coin: a decorative spin (Reanimated) landing on the
                      real random outcome that decides the winner below. */}
                  {tossMode === 'COIN' && (
                    <View style={styles.coinContainer} testID="coin-flip">
                      <Animated.View style={[styles.coin, coinAnimatedStyle]}>
                        <View style={styles.coinInner}>
                          <Text style={styles.coinText}>
                            {coinOutcome === 'TAILS' ? 'T' : coinOutcome === 'HEADS' ? 'H' : '?'}
                          </Text>
                        </View>
                      </Animated.View>
                      {coinOutcome && !flipping && (
                        <PopReveal revealKey={coinOutcome} testID="coin-outcome">
                          <Text style={styles.outcomePill}>
                            {coinOutcome === 'HEADS' ? 'Heads!' : 'Tails!'}
                          </Text>
                        </PopReveal>
                      )}
                    </View>
                  )}

                  {tossMode === 'COIN' && !tossWinnerSide && (
                    <>
                      <Text style={styles.tossLabel}>Who&apos;s calling?</Text>
                      <View style={styles.chipRow}>
                        {matchTeams.map((t) => (
                          <Pressable
                            key={t.match_team_id}
                            onPress={() => setCaller(t.side_label)}
                            disabled={flipping}
                            style={[styles.chip, caller === t.side_label && styles.chipSelected]}
                            testID={`toss-caller-${t.side_label}`}
                          >
                            <Text style={styles.chipText} numberOfLines={1}>
                              {teamName(t.side_label)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.tossLabel}>Their call?</Text>
                      <View style={styles.chipRow}>
                        {(['HEADS', 'TAILS'] as const).map((c) => (
                          <Pressable
                            key={c}
                            onPress={() => setCall(c)}
                            disabled={flipping}
                            style={[styles.chip, call === c && styles.chipSelected]}
                            testID={`toss-call-${c}`}
                          >
                            <Text style={styles.chipText}>{c === 'HEADS' ? 'Heads' : 'Tails'}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        onPress={flipCoin}
                        disabled={flipping || !caller || !call}
                        style={[
                          styles.primaryButton,
                          (flipping || !caller || !call) && { opacity: 0.4 },
                        ]}
                        testID="flip-coin-button"
                      >
                        <Text style={styles.primaryButtonText}>
                          {flipping ? 'TOSSING…' : 'TOSS COIN'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setTossMode('MANUAL');
                          setTossWinnerSide(null);
                          setCoinOutcome(null);
                        }}
                        testID="toss-mode-MANUAL"
                      >
                        <Text style={styles.linkText}>Already tossed? Enter the result</Text>
                      </Pressable>
                    </>
                  )}

                  {tossMode === 'MANUAL' && (
                    <>
                      <Text style={styles.tossLabel}>Who won the toss?</Text>
                      <View style={styles.chipRow}>
                        {matchTeams.map((t) => (
                          <Pressable
                            key={t.match_team_id}
                            onPress={() => setTossWinnerSide(t.side_label)}
                            style={[
                              styles.chip,
                              tossWinnerSide === t.side_label && styles.chipSelected,
                            ]}
                            testID={`toss-winner-${t.side_label}`}
                          >
                            <Text style={styles.chipText} numberOfLines={1}>
                              {teamName(t.side_label)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {/* Backlog D-3: the manual path gets the same "moment"
                          reveal as the coin. */}
                      {tossWinnerSide && (
                        <PopReveal revealKey={tossWinnerSide} testID="manual-toss-result">
                          <Text style={styles.tossResult}>
                            {teamName(tossWinnerSide)} won the toss!
                          </Text>
                        </PopReveal>
                      )}
                      <Text style={styles.tossLabel}>They chose to…</Text>
                      <View style={styles.chipRow}>
                        {(['BAT', 'BOWL'] as const).map((decision) => (
                          <Pressable
                            key={decision}
                            onPress={() => setTossDecision(decision)}
                            style={[styles.chip, tossDecision === decision && styles.chipSelected]}
                            testID={`toss-decision-${decision}`}
                          >
                            <Text style={styles.chipText}>{decision}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        onPress={() => submitToss()}
                        disabled={!tossWinnerSide || !tossDecision}
                        style={[
                          styles.primaryButton,
                          (!tossWinnerSide || !tossDecision) && { opacity: 0.4 },
                        ]}
                        testID="record-toss-button"
                      >
                        <Text style={styles.primaryButtonText}>RECORD TOSS</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setTossMode('COIN');
                          setTossWinnerSide(null);
                          setTossDecision(null);
                        }}
                        testID="toss-mode-COIN"
                      >
                        <Text style={styles.linkText}>Flip a coin instead</Text>
                      </Pressable>
                    </>
                  )}

                  {tossMode === 'COIN' && tossWinnerSide && !flipping && (
                    <>
                      <PopReveal revealKey={tossWinnerSide} testID="coin-flip-result">
                        <Text style={styles.wonBanner}>
                          {teamName(tossWinnerSide)} won the toss!
                        </Text>
                      </PopReveal>
                      <Text style={styles.tossLabel}>What do they choose?</Text>
                      <View style={styles.chipRow}>
                        {(['BAT', 'BOWL'] as const).map((decision) => (
                          <Pressable
                            key={decision}
                            onPress={() => {
                              setTossDecision(decision);
                              submitToss(tossWinnerSide, decision);
                            }}
                            style={styles.decisionButton}
                            testID={`toss-decision-${decision}`}
                          >
                            <Text style={styles.primaryButtonText}>
                              {decision === 'BAT' ? 'BAT FIRST' : 'BOWL FIRST'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable onPress={tossAgain} testID="toss-again">
                        <Text style={styles.linkText}>Toss again</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : (
                <Text style={styles.waitingText}>Waiting for the toss…</Text>
              )
            ) : (
              <>
                <PopReveal
                  revealKey={`${tossWinnerSide}-${tossDecision}`}
                  testID="toss-final-result"
                >
                  <Text style={styles.tossResult}>
                    {tossWinnerSide ? teamName(tossWinnerSide) : 'A team'} won the toss, chose to{' '}
                    {tossDecision === 'BAT' ? 'bat' : 'bowl'}
                  </Text>
                </PopReveal>
                <Pressable onPress={finish} style={styles.primaryButton} testID="continue-to-match">
                  <Text style={styles.primaryButtonText}>CONTINUE</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Backlog D-3: a generic pop-in + fade reveal, re-triggered whenever
// `revealKey` changes — the same scale/opacity shape CountdownNumber below
// already uses for the countdown ticks, generalized so the toss result
// (manual or coin-flip) gets the same "moment" treatment rather than just
// appearing.
function PopReveal({
  children,
  revealKey,
  testID,
}: {
  children: React.ReactNode;
  revealKey: string | number;
  testID?: string;
}) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = 0.5;
    opacity.value = 0;
    scale.value = withSequence(
      withTiming(1.1, { duration: 220, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 120 }),
    );
    opacity.value = withTiming(1, { duration: 220 });
  }, [revealKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle} testID={testID}>
      {children}
    </Animated.View>
  );
}

function CountdownNumber({ value, testID }: { value: number; testID?: string }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = 0.5;
    opacity.value = 0;
    scale.value = withSequence(
      withTiming(1.15, { duration: 220, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 120 }),
    );
    opacity.value = withTiming(1, { duration: 180 });
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.countdownNumber, animatedStyle]} testID={testID}>
      {value}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  shape: { position: 'absolute', backgroundColor: '#D80000' },
  shapeTop: { top: -80, right: -110, width: 220, height: 420, transform: [{ rotate: '25deg' }] },
  shapeBottom: {
    bottom: -100,
    left: -140,
    width: 240,
    height: 460,
    transform: [{ rotate: '25deg' }],
  },
  musicToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontFamily: 'Anton',
    fontSize: 160,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  stageHeader: {
    fontFamily: 'Anton',
    fontSize: 40,
    color: '#D80000',
    letterSpacing: 2,
    marginBottom: 24,
    textAlign: 'center',
  },
  xiContainer: { width: '100%', alignItems: 'center' },
  xiColumn: { width: '100%', paddingHorizontal: 8 },
  xiTeamsRow: { flexDirection: 'row', width: '100%' },
  xiTeamColumn: { flex: 1, paddingHorizontal: 8 },
  xiTeamHeader: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: '#9A9A9A',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  xiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  xiPlayerText: { fontFamily: 'Inter', fontSize: 15, color: '#FFFFFF' },
  captainBadge: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#D80000',
    borderColor: '#D80000',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  tossContainer: { width: '100%', alignItems: 'center' },
  coinContainer: { width: '100%', alignItems: 'center', marginBottom: 8 },
  coin: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#B8862B',
    borderWidth: 6,
    borderColor: '#E9C46A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backfaceVisibility: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  coinInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: '#7A5313',
    backgroundColor: '#C99A3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dark backing so the toss controls stay legible over the red geometry.
  tossPanel: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  coinText: { fontFamily: 'Anton', fontSize: 52, color: '#5E3D0B' },
  chipRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: '#4A4A4A',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 6,
  },
  chipSelected: { backgroundColor: '#D80000', borderColor: '#D80000' },
  chipText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#FFFFFF' },
  primaryButton: {
    backgroundColor: '#D80000',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  primaryButtonText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#FFFFFF', letterSpacing: 1 },
  waitingText: { fontFamily: 'Inter', fontSize: 16, color: '#9A9A9A' },
  tossLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#9A9A9A',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  linkText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#B5B5B5',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 18,
  },
  outcomePill: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#0D0D0D',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  wonBanner: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    backgroundColor: '#D80000',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 10,
    overflow: 'hidden',
    textAlign: 'center',
    marginBottom: 20,
  },
  decisionButton: {
    backgroundColor: '#D80000',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginHorizontal: 6,
  },
  tossResult: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
});
