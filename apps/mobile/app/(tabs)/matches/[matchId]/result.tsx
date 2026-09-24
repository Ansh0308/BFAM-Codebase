import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  matchTeamLabel,
  type BattingRow,
  type BowlingRow,
  type GameRoom,
  type InningsScorecard,
  type IntroMatchTeam,
  type MatchResult,
  type Scorecard,
} from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { Button } from '../../../../src/components/Button';
import { useAuthStore } from '../../../../src/store/authStore';
import { useRebookStore } from '../../../../src/store/rebookStore';

// A-22: highest score / best bowling figures for a completed innings —
// every number here is already computed server-side by getScorecard, this
// just picks the standout row per innings for the summary.
function topBatter(rows: BattingRow[]): BattingRow | null {
  return rows.reduce<BattingRow | null>(
    (best, row) => (!best || row.runs > best.runs ? row : best),
    null,
  );
}

function topBowler(rows: BowlingRow[]): BowlingRow | null {
  return rows.reduce<BowlingRow | null>((best, row) => {
    if (!best) return row;
    if (row.wickets !== best.wickets) return row.wickets > best.wickets ? row : best;
    return row.economy < best.economy ? row : best;
  }, null);
}

function nameOf(p: { full_name?: string | null; bfam_id?: string | null }): string {
  return p.full_name || p.bfam_id || '';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

// Match Result (PRD §12.18 requirement 5). Nobody fills anything in here any
// more: the first time the organizer/scorer lands on this screen the backend
// works the result out from what was scored (winner, margin, Player of the
// Match) and this screen just presents it — see
// .claude/MATCH_REVAMP_PLAN.md.
export default function MatchResultScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  // Long tail — Peak-viewer analytics (G-25).
  const [peakViewers, setPeakViewers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rebooking, setRebooking] = useState(false);
  const [rebookError, setRebookError] = useState<string | null>(null);
  const setRebookPlan = useRebookStore((s) => s.setPlan);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gameRoom, intro, scorecardData] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
        apiClient.getScorecard(matchId).catch(() => null),
      ]);
      setRoom(gameRoom);
      setMatchTeams(intro?.matchTeams ?? gameRoom.match_teams ?? []);
      setScorecard(scorecardData);

      let existing = await apiClient.getMatchResult(matchId).catch(() => null);
      const isManager =
        gameRoom.organizer_id === user?.user_id || gameRoom.assigned_scorer_id === user?.user_id;
      if (!existing && isManager) {
        // Finish Match lands here — finalize automatically (idempotent on
        // the server, so a double-mount can't create two results).
        try {
          await apiClient.finalizeMatch(matchId);
          existing = await apiClient.getMatchResult(matchId).catch(() => null);
        } catch (err) {
          setError(err instanceof BFAMApiError ? err.message : 'Could not finalize the match.');
        }
      }
      setResult(existing);
      apiClient
        .getViewerCount(matchId)
        .then((res) => setPeakViewers(res.peak))
        .catch(() => {});
    } catch {
      setError('Could not load match result data.');
    } finally {
      setLoading(false);
    }
  }, [matchId, user?.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Rebook Same Players (module 2.10, PRD §12.44): fetches the same turf/
  // format/roster and hands it to the availability screen (module 2.3) via
  // rebookStore — Create Game (module 2.6) reads it back once the new
  // booking is confirmed.
  async function rebook() {
    setRebooking(true);
    setRebookError(null);
    try {
      const info = await apiClient.getRebookInfo(matchId);
      setRebookPlan(info);
      router.push(
        `/(tabs)/discover/turf/${info.turf_id}/availability?turfName=${encodeURIComponent(info.turf_name)}`,
      );
    } catch (err) {
      setRebookError(err instanceof BFAMApiError ? err.message : 'Could not start a rebook.');
    } finally {
      setRebooking(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="result-loading" />
        <Text style={styles.centerText}>Working out the result…</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.center} testID="result-error">
        <Text style={styles.centerText}>Could not load this match.</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.center} testID="result-not-finalized">
        <Text style={styles.centerText}>{error ?? "The result hasn't been finalized yet."}</Text>
        {error && (
          <View style={{ marginTop: 16, width: 200 }}>
            <Button label="Try Again" onPress={load} testID="result-retry" />
          </View>
        )}
      </View>
    );
  }

  const labelFor = (matchTeamId: string | null | undefined, fallback = 'A team') => {
    const t = matchTeams.find((m) => m.match_team_id === matchTeamId);
    return t ? matchTeamLabel(t) : fallback;
  };
  const winnerName = result.winning_team_name || labelFor(result.winning_match_team_id);
  const headline =
    result.result_type === 'WIN'
      ? `${winnerName} won`
      : result.result_type === 'TIE'
        ? 'Match tied'
        : 'No result';

  const innings: InningsScorecard[] = scorecard?.innings ?? [];
  const potmName = result.player_of_the_match_name || result.player_of_the_match_bfam_id || null;
  const potmStats = result.player_of_the_match_stats;
  const potmLine = potmStats
    ? [
        potmStats.runs > 0 || potmStats.balls > 0
          ? `${potmStats.runs} runs (${potmStats.balls} balls)`
          : null,
        potmStats.wickets > 0 ? plural(potmStats.wickets, 'wicket') : null,
      ]
        .filter(Boolean)
        .join('  ·  ')
    : '';
  const isOrganizer = room.organizer_id === user?.user_id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="result-display">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero: same black stage + diagonal red geometry as the match intro. */}
        <SafeAreaView edges={['top']} style={styles.hero}>
          <View style={[styles.shape, styles.shapeTop]} pointerEvents="none" />
          <View style={[styles.shape, styles.shapeBottom]} pointerEvents="none" />
          <View style={styles.heroInner}>
            <Text style={styles.eyebrow}>
              {room.match_name ? room.match_name.toUpperCase() : 'MATCH RESULT'}
            </Text>
            <Feather name="award" size={30} color={colors.brandRed} style={{ marginTop: 14 }} />
            <Text style={styles.headline} testID="result-headline">
              {headline.toUpperCase()}
            </Text>
            {result.result_type === 'WIN' && result.winning_margin ? (
              <Text style={styles.margin} testID="result-margin">
                by {result.winning_margin}
              </Text>
            ) : null}

            {innings.length > 0 && (
              <View style={styles.scoreBoard} testID="result-scoreboard">
                {innings.map((inn) => {
                  const won =
                    result.result_type === 'WIN' &&
                    inn.batting_match_team_id === result.winning_match_team_id;
                  return (
                    <View
                      key={inn.innings_id}
                      style={[styles.scoreRow, won && styles.scoreRowWinner]}
                      testID={`scoreboard-innings-${inn.innings_number}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scoreTeam} numberOfLines={1}>
                          {inn.batting_team_name || labelFor(inn.batting_match_team_id, 'Team')}
                        </Text>
                        <Text style={styles.scoreOvers}>{inn.overs_completed} overs</Text>
                      </View>
                      <Text style={styles.scoreValue}>
                        {inn.total_runs}
                        <Text style={styles.scoreWickets}>/{inn.total_wickets}</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </SafeAreaView>

        <View style={{ paddingHorizontal: 20, marginTop: -28 }}>
          {potmName && (
            <View style={styles.potmCard} testID="potm-card">
              <View style={styles.potmAvatar}>
                <Text style={styles.potmInitials}>{initials(potmName)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.potmLabel}>PLAYER OF THE MATCH</Text>
                <Text style={styles.potmName} numberOfLines={1} testID="potm-name">
                  {potmName}
                </Text>
                {potmLine ? (
                  <Text style={styles.potmStats} testID="potm-stats">
                    {potmLine}
                  </Text>
                ) : null}
              </View>
              <Feather name="star" size={22} color={colors.brandRed} />
            </View>
          )}

          {rebookError && (
            <Text
              className="text-brand-red text-body mt-4 text-center"
              testID="rebook-error-message"
            >
              {rebookError}
            </Text>
          )}

          {/* A-22: run rate, top score, and best bowling per innings. */}
          {innings.length > 0 && (
            <View style={{ marginTop: 28 }} testID="match-summary">
              <Text style={styles.sectionTitle}>MATCH SUMMARY</Text>
              {innings.map((inn) => {
                const topBat = topBatter(inn.batting);
                const topBowl = topBowler(inn.bowling);
                return (
                  <View
                    key={inn.innings_id}
                    style={styles.inningsCard}
                    testID={`match-summary-innings-${inn.innings_number}`}
                  >
                    <View style={styles.inningsHeader}>
                      <Text style={styles.inningsTitle}>
                        {inn.batting_team_name || `Innings ${inn.innings_number}`}
                      </Text>
                      <Text style={styles.inningsScore}>
                        {inn.total_runs}/{inn.total_wickets} ({inn.overs_completed} ov)
                      </Text>
                    </View>
                    <Text style={styles.runRate}>Run rate {inn.run_rate}</Text>
                    {topBat && (
                      <View style={styles.perfRow}>
                        <Feather name="disc" size={14} color={colors.brandRed} />
                        <Text style={styles.perfText}>
                          <Text style={styles.perfName}>{nameOf(topBat)}</Text> {topBat.runs} (
                          {topBat.balls}b · {topBat.fours}×4 · {topBat.sixes}×6)
                        </Text>
                      </View>
                    )}
                    {topBowl && (
                      <View style={styles.perfRow}>
                        <Feather name="circle" size={14} color={colors.brandRed} />
                        <Text style={styles.perfText}>
                          <Text style={styles.perfName}>{nameOf(topBowl)}</Text> {topBowl.wickets}/
                          {topBowl.runs_conceded} ({topBowl.overs} ov · econ {topBowl.economy})
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {peakViewers !== null && peakViewers > 0 && (
                <Text style={styles.peak} testID="peak-viewers">
                  Peak viewers: {peakViewers}
                </Text>
              )}
            </View>
          )}

          <View style={{ marginTop: 20 }}>
            <Button
              label="Full Scorecard"
              variant="secondary"
              iconLeft={<Feather name="list" size={16} color="#D80000" />}
              onPress={() => router.push(`/(tabs)/matches/${matchId}/scorecard`)}
              testID="open-scorecard"
            />
          </View>
          {/* Backlog B-4: prompts the player to review the match/turf right
              where they land after it's finalized. */}
          <View style={{ marginTop: 12 }}>
            <Button
              label="Rate This Match"
              variant="secondary"
              iconLeft={<Feather name="star" size={16} color="#0D0D0D" />}
              onPress={() => router.push(`/match-review?matchId=${matchId}`)}
              testID="open-review"
            />
          </View>
          {isOrganizer && (
            <View style={{ marginTop: 12 }}>
              <Button
                label="Rebook Same Players"
                iconLeft={<Feather name="repeat" size={16} color="#FFFFFF" />}
                onPress={rebook}
                loading={rebooking}
                testID="rebook-same-players"
              />
            </View>
          )}
          <View style={{ height: 48 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.surface,
  },
  centerText: {
    fontFamily: 'Inter',
    fontSize: 16,
    color: '#767676',
    textAlign: 'center',
    marginTop: 12,
  },
  hero: { backgroundColor: '#000000', overflow: 'hidden', paddingBottom: 56 },
  shape: { position: 'absolute', backgroundColor: colors.brandRed },
  shapeTop: { top: -120, right: -150, width: 190, height: 300, transform: [{ rotate: '25deg' }] },
  shapeBottom: {
    bottom: -230,
    left: -160,
    width: 200,
    height: 300,
    transform: [{ rotate: '25deg' }],
  },
  heroInner: { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  eyebrow: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  headline: {
    fontFamily: 'Anton',
    fontSize: 44,
    lineHeight: 50,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
  },
  margin: { fontFamily: 'Inter-Bold', fontSize: 18, color: '#FFFFFF', marginTop: 4 },
  scoreBoard: { width: '100%', marginTop: 24 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  scoreRowWinner: { backgroundColor: 'rgba(255,255,255,0.16)', borderLeftColor: colors.brandRed },
  scoreTeam: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFFFFF' },
  scoreOvers: { fontFamily: 'Inter', fontSize: 12, color: '#B5B5B5', marginTop: 2 },
  scoreValue: { fontFamily: 'Anton', fontSize: 30, color: '#FFFFFF' },
  scoreWickets: { fontFamily: 'Anton', fontSize: 20, color: '#B5B5B5' },
  potmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEDEE',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  potmAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0D0D0D',
  },
  potmInitials: { fontFamily: 'Anton', fontSize: 22, color: '#FFFFFF', letterSpacing: 1 },
  potmLabel: { fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 1.5, color: colors.brandRed },
  potmName: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#0D0D0D', marginTop: 2 },
  potmStats: { fontFamily: 'Inter', fontSize: 13, color: '#444444', marginTop: 2 },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#767676',
    marginBottom: 10,
  },
  inningsCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandRed,
  },
  inningsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  inningsTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#0D0D0D',
    flex: 1,
    marginRight: 8,
  },
  inningsScore: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#0D0D0D' },
  runRate: { fontFamily: 'Inter', fontSize: 12, color: '#767676', marginTop: 2, marginBottom: 8 },
  perfRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  perfText: { fontFamily: 'Inter', fontSize: 14, color: '#111111', marginLeft: 8, flex: 1 },
  perfName: { fontFamily: 'Inter-Bold' },
  peak: { fontFamily: 'Inter', fontSize: 12, color: '#767676', textAlign: 'center', marginTop: 4 },
});
