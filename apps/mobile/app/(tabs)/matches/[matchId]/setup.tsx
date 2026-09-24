import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { matchTeamLabel, type GameRoom, type IntroMatchTeam } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';

const OVER_PRESETS = [3, 5, 6, 8, 10, 15, 20];
const SIDE_COLOR: Record<'TEAM_A' | 'TEAM_B', string> = {
  TEAM_A: colors.brandRed,
  TEAM_B: '#F2F2F2',
};
const SIDE_LETTER: Record<'TEAM_A' | 'TEAM_B', string> = { TEAM_A: 'A', TEAM_B: 'B' };

function displayName(p: { full_name?: string | null; bfam_id?: string }): string {
  return p.full_name || p.bfam_id || '';
}

// Match Setup (see .claude/MATCH_REVAMP_PLAN.md): everything decided BEFORE
// the cinematic intro and the toss — name both teams, put every player on a
// side, overs and rules — so by the time the coin is flipped everyone knows
// exactly who "Team A" and "Team B" are.
export default function MatchSetupScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [teams, setTeams] = useState<IntroMatchTeam[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [overs, setOvers] = useState(6);
  const [singleBatter, setSingleBatter] = useState(true);
  const [extrasCount, setExtrasCount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [balancing, setBalancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const gameRoom = await apiClient.getGameRoom(matchId);
      setRoom(gameRoom);
      const matchTeams = gameRoom.match_teams ?? [];
      setTeams(matchTeams);
      setNames(Object.fromEntries(matchTeams.map((t) => [t.match_team_id, t.team_name ?? ''])));
      setAssignments(
        Object.fromEntries(gameRoom.players.map((p) => [p.player_id, p.match_team_id ?? null])),
      );
      setOvers(gameRoom.overs_per_innings);
      setSingleBatter(gameRoom.no_non_striker ?? true);
      setExtrasCount(gameRoom.extras_count_toward_score ?? true);
    } catch {
      setError('Could not load this match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Anyone who hasn't said they can't play is on a side — same rule as the
  // rest of the match flow (a player who showed up but never tapped Confirm
  // still plays).
  const eligible = room?.players.filter((p) => p.invitation_status !== 'CANT_PLAY') ?? [];
  const teamA = teams.find((t) => t.side_label === 'TEAM_A');
  const teamB = teams.find((t) => t.side_label === 'TEAM_B');
  const countFor = (teamId?: string) =>
    eligible.filter((p) => teamId && assignments[p.player_id] === teamId).length;
  const unassigned = eligible.filter((p) => !assignments[p.player_id]);
  const canStart =
    eligible.length > 0 &&
    unassigned.length === 0 &&
    countFor(teamA?.match_team_id) > 0 &&
    countFor(teamB?.match_team_id) > 0;

  const nameFor = (t: IntroMatchTeam) =>
    names[t.match_team_id]?.trim() || matchTeamLabel({ ...t, team_name: null });

  async function autoBalance() {
    if (!teamA || !teamB) return;
    setBalancing(true);
    setError(null);
    try {
      const suggestion = await apiClient.getBalancedTeams(matchId);
      setAssignments((prev) => {
        const next = { ...prev };
        for (const p of suggestion.team_a) next[p.player_id] = teamA.match_team_id;
        for (const p of suggestion.team_b) next[p.player_id] = teamB.match_team_id;
        return next;
      });
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not balance the teams.');
    } finally {
      setBalancing(false);
    }
  }

  async function start() {
    if (!canStart || !teamA || !teamB) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateMatchSetup(matchId, {
        team_names: teams.map((t) => ({
          match_team_id: t.match_team_id,
          team_name: names[t.match_team_id]?.trim() || null,
        })),
        overs_per_innings: overs,
        no_non_striker: singleBatter,
        extras_count_toward_score: extrasCount,
      });
      await apiClient.assignPlayerSides(
        matchId,
        eligible.map((p) => ({
          player_id: p.player_id,
          match_team_id: assignments[p.player_id] as string,
        })),
      );
      router.replace(`/(tabs)/matches/${matchId}/intro`);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not start the match.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={colors.brandRed} testID="setup-loading" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.root, styles.center]} testID="setup-error">
        <Text style={styles.muted}>{error ?? 'Could not load this match.'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="setup-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Start a match</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="setup-close"
        >
          <Feather name="x" size={26} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionLabel}>TEAMS</Text>
        {[teamA, teamB].map((t) =>
          t ? (
            <View
              key={t.match_team_id}
              style={styles.teamCard}
              testID={`team-card-${t.side_label}`}
            >
              <View style={[styles.dot, { backgroundColor: SIDE_COLOR[t.side_label] }]} />
              <TextInput
                value={names[t.match_team_id] ?? ''}
                onChangeText={(v) => setNames((prev) => ({ ...prev, [t.match_team_id]: v }))}
                placeholder={matchTeamLabel({ ...t, team_name: null })}
                placeholderTextColor="#6F6F6F"
                maxLength={60}
                style={styles.teamInput}
                testID={`team-name-${t.side_label}`}
              />
              <Text style={styles.count} testID={`team-count-${t.side_label}`}>
                {countFor(t.match_team_id)}
              </Text>
            </View>
          ) : null,
        )}

        <Pressable
          onPress={autoBalance}
          disabled={balancing}
          style={[styles.outlineButton, balancing && { opacity: 0.5 }]}
          testID="auto-balance"
        >
          <Feather name="shuffle" size={16} color="#FFFFFF" />
          <Text style={styles.outlineButtonText}>
            {balancing ? 'Balancing…' : 'Balance teams by skill'}
          </Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
          PLAYERS{unassigned.length > 0 ? `  ·  ${unassigned.length} to place` : ''}
        </Text>
        {eligible.map((p) => (
          <View key={p.player_id} style={styles.playerRow} testID={`setup-player-${p.player_id}`}>
            <Text style={styles.playerName} numberOfLines={1}>
              {displayName(p)}
            </Text>
            {[teamA, teamB].map((t) => {
              if (!t) return null;
              const selected = assignments[p.player_id] === t.match_team_id;
              return (
                <Pressable
                  key={t.match_team_id}
                  onPress={() =>
                    setAssignments((prev) => ({ ...prev, [p.player_id]: t.match_team_id }))
                  }
                  style={[
                    styles.sideButton,
                    { borderColor: SIDE_COLOR[t.side_label] },
                    selected && { backgroundColor: SIDE_COLOR[t.side_label] },
                  ]}
                  accessibilityLabel={`${displayName(p)} to ${nameFor(t)}`}
                  testID={`assign-${p.player_id}-${t.side_label}`}
                >
                  <Text
                    style={[
                      styles.sideButtonText,
                      {
                        color: selected
                          ? t.side_label === 'TEAM_A'
                            ? '#FFFFFF'
                            : '#0D0D0D'
                          : '#FFFFFF',
                      },
                    ]}
                  >
                    {SIDE_LETTER[t.side_label]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>OVERS PER INNINGS</Text>
        <View style={styles.oversRow}>
          <Pressable
            onPress={() => setOvers((o) => Math.max(1, o - 1))}
            style={styles.stepper}
            testID="overs-minus"
          >
            <Feather name="minus" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.oversValue} testID="overs-value">
            {overs}
          </Text>
          <Pressable
            onPress={() => setOvers((o) => Math.min(50, o + 1))}
            style={styles.stepper}
            testID="overs-plus"
          >
            <Feather name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.chipWrap}>
          {OVER_PRESETS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setOvers(n)}
              style={[styles.chip, overs === n && styles.chipSelected]}
              testID={`overs-chip-${n}`}
            >
              <Text style={styles.chipText}>{n} overs</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>RULES</Text>
        <View style={styles.ruleCard}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.ruleTitle}>Single batter (box cricket)</Text>
            <Text style={styles.ruleDesc}>
              One batter at the crease, no non-striker and no strike swapping. The innings ends when
              every batter is out.
            </Text>
          </View>
          <Switch
            value={singleBatter}
            onValueChange={setSingleBatter}
            trackColor={{ false: '#3A3A3A', true: colors.brandRed }}
            thumbColor="#FFFFFF"
            testID="rule-single-batter"
          />
        </View>
        <View style={styles.ruleCard}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.ruleTitle}>Extras count toward the score</Text>
            <Text style={styles.ruleDesc}>
              Wides, no-balls, byes and leg-byes add to the team total. Turn off to count only runs
              off the bat.
            </Text>
          </View>
          <Switch
            value={extrasCount}
            onValueChange={setExtrasCount}
            trackColor={{ false: '#3A3A3A', true: colors.brandRed }}
            thumbColor="#FFFFFF"
            testID="rule-extras"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error && (
          <Text style={styles.error} testID="setup-error-message">
            {error}
          </Text>
        )}
        {!canStart && !error && (
          <Text style={styles.hint} testID="setup-hint">
            {unassigned.length > 0
              ? 'Put every player on a team to continue.'
              : 'Each team needs at least one player.'}
          </Text>
        )}
        <Pressable
          onPress={start}
          disabled={!canStart || busy}
          style={[styles.startButton, (!canStart || busy) && { opacity: 0.4 }]}
          testID="setup-start-button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startText}>Start Match</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D0D', paddingHorizontal: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: 'Inter', fontSize: 15, color: '#9A9A9A', textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 26, color: '#FFFFFF' },
  sectionLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#9A9A9A',
    marginBottom: 10,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    height: 62,
  },
  dot: { width: 20, height: 20, borderRadius: 10, marginRight: 14 },
  teamInput: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  count: { fontFamily: 'Anton', fontSize: 22, color: '#9A9A9A', marginLeft: 8 },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4A4A4A',
    borderRadius: 30,
    height: 50,
    marginTop: 4,
  },
  outlineButtonText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#FFFFFF', marginLeft: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
    paddingVertical: 10,
  },
  playerName: { flex: 1, fontFamily: 'Inter', fontSize: 16, color: '#FFFFFF' },
  sideButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sideButtonText: { fontFamily: 'Inter-Bold', fontSize: 15 },
  oversRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  stepper: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oversValue: {
    fontFamily: 'Anton',
    fontSize: 64,
    color: '#FFFFFF',
    minWidth: 120,
    textAlign: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 },
  chip: {
    backgroundColor: '#1F1F1F',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 5,
  },
  chipSelected: { backgroundColor: colors.brandRed },
  chipText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#FFFFFF' },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  ruleTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFFFFF' },
  ruleDesc: { fontFamily: 'Inter', fontSize: 13, color: '#9A9A9A', marginTop: 4 },
  footer: { paddingTop: 8, paddingBottom: 8 },
  error: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#9A9A9A',
    textAlign: 'center',
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: colors.brandRed,
    borderRadius: 30,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { fontFamily: 'Inter-Bold', fontSize: 18, color: '#FFFFFF', letterSpacing: 0.5 },
});
