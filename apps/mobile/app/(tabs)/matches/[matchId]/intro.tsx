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
import type { IntroMatchTeam, PlayingXiPlayer } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { getSocket, joinMatchRoom, leaveMatchRoom } from '../../../../src/lib/socket';
import { playTriggerSound } from '../../../../src/lib/sounds';
import { useAuthStore } from '../../../../src/store/authStore';

type Stage = 'COUNTDOWN' | 'XI_REVEAL' | 'TOSS' | 'DONE';
const COUNTDOWN_SECONDS = 10;
const XI_REVEAL_MS = 4000;

// Cinematic Match Countdown Intro (module 2.7, PRD §12.61). Design
// Document §5 calls this out as "the strongest expression of the brand-
// red/black/white system" — full black stage, oversized diagonal red
// geometry, and scoreboard-style typography, more than anywhere else in
// the app. One-time, full-screen sequence: COUNTDOWN -> XI_REVEAL -> TOSS
// -> hands off to Live Scoring (module 2.8, stub only here).
export default function MatchIntroScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [stage, setStage] = useState<Stage>('COUNTDOWN');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [players, setPlayers] = useState<PlayingXiPlayer[]>([]);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicAvailable, setMusicAvailable] = useState(false);
  const [tossWinnerSide, setTossWinnerSide] = useState<'TEAM_A' | 'TEAM_B' | null>(null);
  const [tossDecision, setTossDecision] = useState<'BAT' | 'BOWL' | null>(null);
  const [tossRecorded, setTossRecorded] = useState(false);

  const emittedStages = useRef(new Set<Stage>());

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
      .then((room) => {
        const manager =
          room.organizer_id === user?.user_id || room.assigned_scorer_id === user?.user_id;
        setIsOrganizer(manager);
        const contextCall = manager
          ? apiClient.startMatchIntro(matchId)
          : apiClient.getMatchIntro(matchId);
        return contextCall.then((res) => {
          setPlayers(res.players);
          setMatchTeams(res.matchTeams);
          setMusicAvailable(res.intro.background_music_enabled);
          setMusicEnabled(res.intro.background_music_enabled);
          if (manager) {
            playTriggerSound('COUNTDOWN_START', res.intro.background_music_enabled).catch(() => {});
            emitStage('COUNTDOWN', {});
          }
        });
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

  // COUNTDOWN: 10 -> 0, presenter-only (a passive viewer just sees a
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

  async function submitToss() {
    if (!tossWinnerSide || !tossDecision) return;
    const winnerMatchTeamId = matchTeams.find(
      (t) => t.side_label === tossWinnerSide,
    )?.match_team_id;
    if (!winnerMatchTeamId) return;
    try {
      await apiClient.recordToss(matchId, winnerMatchTeamId, tossDecision);
    } catch {
      // don't block the sequence on a network hiccup — the result is
      // still shown locally, and the organizer can be the source of
      // truth if a retry is needed.
    }
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

      <View style={styles.content}>
        {stage === 'COUNTDOWN' &&
          (isOrganizer ? (
            <CountdownNumber value={count} testID="intro-countdown" />
          ) : (
            <Text style={styles.waitingText} testID="intro-countdown-waiting">
              Get ready — match starting…
            </Text>
          ))}

        {stage === 'XI_REVEAL' && (
          <View style={styles.xiContainer} testID="intro-xi-reveal">
            <Text style={styles.stageHeader}>PLAYING XI</Text>
            <View style={styles.xiColumn}>
              {players.map((p) => (
                <View key={p.player_id} style={styles.xiRow} testID={`xi-player-${p.player_id}`}>
                  <Text style={styles.xiPlayerText}>{p.bfam_id}</Text>
                  {p.participant_role === 'CAPTAIN' && <Text style={styles.captainBadge}>C</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {stage === 'TOSS' && (
          <View style={styles.tossContainer} testID="intro-toss">
            <Text style={styles.stageHeader}>TOSS</Text>
            {!tossRecorded ? (
              isOrganizer ? (
                <View style={{ width: '100%' }}>
                  <View style={styles.chipRow}>
                    {(['TEAM_A', 'TEAM_B'] as const).map((side) => (
                      <Pressable
                        key={side}
                        onPress={() => setTossWinnerSide(side)}
                        style={[styles.chip, tossWinnerSide === side && styles.chipSelected]}
                        testID={`toss-winner-${side}`}
                      >
                        <Text style={styles.chipText}>
                          {side === 'TEAM_A' ? 'Team A' : 'Team B'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
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
                    onPress={submitToss}
                    disabled={!tossWinnerSide || !tossDecision}
                    style={[
                      styles.primaryButton,
                      (!tossWinnerSide || !tossDecision) && { opacity: 0.4 },
                    ]}
                    testID="record-toss-button"
                  >
                    <Text style={styles.primaryButtonText}>RECORD TOSS</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.waitingText}>Waiting for the toss…</Text>
              )
            ) : (
              <>
                <Text style={styles.tossResult}>
                  {tossWinnerSide === 'TEAM_A' ? 'Team A' : 'Team B'} won the toss, chose to{' '}
                  {tossDecision === 'BAT' ? 'bat' : 'bowl'}
                </Text>
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
  tossResult: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
});
