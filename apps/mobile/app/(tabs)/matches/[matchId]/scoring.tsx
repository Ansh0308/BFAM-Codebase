import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { GameRoom, IntroMatchTeam, LiveScore, WicketType } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { ChipSelect } from '../../../../src/components/ChipSelect';
import { TextField } from '../../../../src/components/TextField';
import { playTriggerSound } from '../../../../src/lib/sounds';

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6];
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

  const [battingSide, setBattingSide] = useState<string | null>(null);
  const [bowlingSide, setBowlingSide] = useState<string | null>(null);
  const [targetRuns, setTargetRuns] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gameRoom, intro, liveScore] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
        apiClient.getLiveScore(matchId),
      ]);
      setRoom(gameRoom);
      setMatchTeams(intro?.matchTeams ?? []);
      setLive(liveScore);
      if (intro) setMusicEnabled(intro.intro.background_music_enabled);
    } catch {
      setError('Could not load scoring data.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmedPlayers = room?.players.filter((p) => p.invitation_status === 'CONFIRMED') ?? [];
  const playerOptions = confirmedPlayers.map((p) => ({
    value: p.player_id,
    label: p.bfam_id ?? '',
  }));

  async function startInnings() {
    if (!battingSide || !bowlingSide) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.startInnings(matchId, {
        innings_number: (live?.innings ? live.innings.innings_number : 0) + 1,
        batting_match_team_id: battingSide,
        bowling_match_team_id: bowlingSide,
        target_runs: targetRuns ? Number(targetRuns) : null,
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
    extra_type: 'NONE' | ExtraKind;
    extra_runs: number;
    is_wicket: boolean;
    wicket_type?: WicketType | null;
  }) {
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
      setPendingExtra(null);
      setPendingWicket(false);
      setWicketType(null);
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not record that ball.');
    } finally {
      setBusy(false);
    }
  }

  function pressRun(n: number) {
    if (pendingWicket) return; // wicket flow uses its own confirm
    if (pendingExtra) {
      const isWideOrNoBall = pendingExtra === 'WIDE' || pendingExtra === 'NO_BALL';
      submitBall({
        runs_scored: isWideOrNoBall ? 0 : n,
        extra_type: pendingExtra,
        extra_runs: isWideOrNoBall ? 1 + n : n,
        is_wicket: false,
      });
      return;
    }
    submitBall({ runs_scored: n, extra_type: 'NONE', extra_runs: 0, is_wicket: false });
  }

  function confirmWicket() {
    if (!wicketType) return;
    submitBall({
      runs_scored: 0,
      extra_type: 'NONE',
      extra_runs: 0,
      is_wicket: true,
      wicket_type: wicketType,
    });
  }

  async function undo() {
    if (!live?.innings) return;
    setBusy(true);
    try {
      await apiClient.undoBall(live.innings.innings_id);
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
            disabled={!battingSide}
            testID="start-innings-button"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" testID="scoring-interface-screen">
      <View className="px-6 pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">
          {live.innings.total_runs}/{live.innings.total_wickets}
          <Text className="font-ui text-body text-text-secondary">
            {' '}
            ({live.innings.overs_completed} ov)
          </Text>
        </Text>

        <View className="mt-4">
          <ChipSelect
            label="Striker"
            options={playerOptions}
            value={strikerId}
            onChange={setStrikerId}
            testID="striker-select"
          />
          <ChipSelect
            label="Non-Striker"
            options={playerOptions}
            value={nonStrikerId}
            onChange={setNonStrikerId}
            testID="non-striker-select"
          />
          <ChipSelect
            label="Bowler"
            options={playerOptions}
            value={bowlerId}
            onChange={setBowlerId}
            testID="bowler-select"
          />
        </View>

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
                  onPress={() => setWicketType(wt)}
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
            <View className="flex-row mt-3">
              <View className="flex-1 mr-2">
                <Button
                  label="Confirm Wicket"
                  onPress={confirmWicket}
                  disabled={!wicketType}
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
                  }}
                  testID="cancel-wicket"
                />
              </View>
            </View>
          </View>
        ) : (
          <>
            {pendingExtra && (
              <View className="bg-surface-alt rounded-md p-3 mt-2 mb-2">
                <Text className="font-ui text-micro text-text-secondary">
                  {pendingExtra.replace('_', ' ')} armed — tap a run value for additional runs, or 0
                  for none.
                </Text>
              </View>
            )}
            <View className="flex-row flex-wrap mt-2" style={{ marginHorizontal: -4 }}>
              {RUN_BUTTONS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => pressRun(n)}
                  disabled={busy || !strikerId || !bowlerId}
                  className="items-center justify-center bg-brand-red rounded-md m-1"
                  style={{
                    width: 64,
                    height: 56,
                    opacity: busy || !strikerId || !bowlerId ? 0.5 : 1,
                  }}
                  testID={`run-${n}`}
                >
                  <Text className="font-ui font-bold text-title-xl text-white">{n}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row flex-wrap mt-2" style={{ marginHorizontal: -4 }}>
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
              <Pressable
                onPress={() => setPendingWicket(true)}
                className="rounded-md bg-ink-black px-4 py-3 m-1"
                testID="wicket-button"
              >
                <Text className="font-ui font-bold text-body text-white">WICKET</Text>
              </Pressable>
            </View>
          </>
        )}

        <View className="mt-6 mb-10">
          <Button
            label="Undo Last Ball"
            variant="secondary"
            onPress={undo}
            loading={busy}
            testID="undo-button"
          />
          {live.innings.innings_number === 1 && (
            <View className="mt-3">
              <Button
                label="End Innings & Start Next"
                variant="secondary"
                onPress={endInningsAndStartNext}
                loading={busy}
                testID="end-innings-button"
              />
            </View>
          )}
          <View className="mt-3">
            <Button
              label="View Live Score"
              variant="ghost"
              onPress={() => router.push(`/(tabs)/matches/${matchId}/live`)}
              testID="back-to-live"
            />
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
        </View>
      </View>
    </ScrollView>
  );
}
