import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { GameRoom, IntroMatchTeam, MatchResult } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { ChipSelect } from '../../../../src/components/ChipSelect';
import { useAuthStore } from '../../../../src/store/authStore';
import { useRebookStore } from '../../../../src/store/rebookStore';

const RESULT_TYPES: { value: 'WIN' | 'TIE' | 'NO_RESULT'; label: string }[] = [
  { value: 'WIN', label: 'Win' },
  { value: 'TIE', label: 'Tie' },
  { value: 'NO_RESULT', label: 'No Result' },
];

// Match Result (PRD §12.18 requirement 5): winner, margin, Player of the
// Match. Links out to Statistics (module 2.10) as a stub only.
export default function MatchResultScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [matchTeams, setMatchTeams] = useState<IntroMatchTeam[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [resultType, setResultType] = useState<'WIN' | 'TIE' | 'NO_RESULT'>('WIN');
  const [winningSide, setWinningSide] = useState<string | null>(null);
  const [margin, setMargin] = useState('');
  const [potmId, setPotmId] = useState<string | null>(null);

  const [rebooking, setRebooking] = useState(false);
  const [rebookError, setRebookError] = useState<string | null>(null);
  const setRebookPlan = useRebookStore((s) => s.setPlan);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gameRoom, intro] = await Promise.all([
        apiClient.getGameRoom(matchId),
        apiClient.getMatchIntro(matchId).catch(() => null),
      ]);
      setRoom(gameRoom);
      setMatchTeams(intro?.matchTeams ?? []);
      const existingResult = await apiClient.getMatchResult(matchId).catch(() => null);
      setResult(existingResult);
    } catch {
      setError('Could not load match result data.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function finalize() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.finalizeMatch(matchId, {
        result_type: resultType,
        winning_match_team_id: resultType === 'WIN' ? winningSide : null,
        winning_margin: margin || null,
        player_of_the_match_id: potmId,
      });
      await load();
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not finalize the match.');
    } finally {
      setBusy(false);
    }
  }

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
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="result-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="result-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            Could not load this match.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const isManager =
    room.organizer_id === user?.user_id || room.assigned_scorer_id === user?.user_id;
  const confirmedPlayers = room.players.filter((p) => p.invitation_status === 'CONFIRMED');

  if (result) {
    const winningSideLabel = matchTeams.find(
      (t) => t.match_team_id === result.winning_match_team_id,
    )?.side_label;
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6" testID="result-display">
          <Feather name="award" size={56} color="#D80000" />
          <Text className="font-ui font-bold text-title-xl text-ink-black text-center mt-4">
            {result.result_type === 'WIN'
              ? `${winningSideLabel === 'TEAM_A' ? 'Team A' : 'Team B'} Won`
              : result.result_type === 'TIE'
                ? 'Match Tied'
                : 'No Result'}
          </Text>
          {result.winning_margin && (
            <Text className="font-ui text-body text-text-secondary text-center mt-2">
              {result.winning_margin}
            </Text>
          )}
          {result.player_of_the_match_bfam_id && (
            <View className="rounded-full border border-brand-red px-4 py-2 mt-6">
              <Text className="font-ui font-bold text-body text-brand-red">
                Player of the Match: {result.player_of_the_match_bfam_id}
              </Text>
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
          <View className="mt-8 w-full">
            <Button
              label="Statistics"
              variant="secondary"
              onPress={() => router.push('/player-statistics')}
              testID="open-statistics"
            />
          </View>
          {room.organizer_id === user?.user_id && (
            <View className="mt-3 w-full">
              <Button
                label="Rebook Same Players"
                iconLeft={<Feather name="repeat" size={16} color="#FFFFFF" />}
                onPress={rebook}
                loading={rebooking}
                testID="rebook-same-players"
              />
            </View>
          )}
          <View className="mt-3 w-full">
            <Button
              label="Dispute Result"
              variant="ghost"
              iconLeft={<Feather name="flag" size={16} color="#767676" />}
              onPress={() => router.push(`/match-dispute?matchId=${matchId}`)}
              testID="open-dispute"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (!isManager) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="result-not-finalized">
          <Text className="font-ui text-body text-text-secondary text-center">
            The result hasn&apos;t been finalized yet.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View className="pt-6" testID="finalize-result-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Finalize Result</Text>

        <ChipSelect
          label="Result"
          options={RESULT_TYPES}
          value={resultType}
          onChange={(v) => setResultType(v as typeof resultType)}
          testID="result-type"
        />

        {resultType === 'WIN' && (
          <ChipSelect
            label="Winning Side"
            options={matchTeams.map((t) => ({
              value: t.match_team_id,
              label: t.side_label === 'TEAM_A' ? 'Team A' : 'Team B',
            }))}
            value={winningSide}
            onChange={setWinningSide}
            testID="winning-side"
          />
        )}

        <TextField
          label="Margin (optional)"
          value={margin}
          onChangeText={setMargin}
          placeholder="e.g. 24 runs"
          testID="margin-input"
        />

        <ChipSelect
          label="Player of the Match"
          options={confirmedPlayers.map((p) => ({ value: p.player_id, label: p.bfam_id ?? '' }))}
          value={potmId}
          onChange={setPotmId}
          testID="potm-select"
        />

        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

        <Button label="Finalize Match" onPress={finalize} loading={busy} testID="finalize-button" />
      </View>
    </ScreenContainer>
  );
}
