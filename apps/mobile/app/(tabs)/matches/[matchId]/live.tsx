import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { GameRoom, LiveScore } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { ViewerCountBadge } from '../../../../src/components/ViewerCountBadge';
import { useAuthStore } from '../../../../src/store/authStore';

function bfamIdFor(players: GameRoom['players'], playerId: string | null | undefined) {
  return players.find((p) => p.player_id === playerId)?.bfam_id ?? '—';
}

// Live Score viewer (PRD §12.18 requirement 3): score header, overs/
// wickets, current batsmen/bowler, target/RRR/CRR where applicable.
// "👁 N Watching Live" is module 2.9's ViewerCountBadge.
export default function LiveScoreScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [live, setLive] = useState<LiveScore | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([apiClient.getLiveScore(matchId), apiClient.getGameRoom(matchId)])
      .then(([liveScore, gameRoom]) => {
        setLive(liveScore);
        setRoom(gameRoom);
      })
      .catch(() => {
        setLive(null);
        setRoom(null);
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="live-score-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center" testID="live-score-error">
          <Text className="font-ui text-body text-text-secondary text-center">
            Could not load this match.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const isManager =
    room.organizer_id === user?.user_id || room.assigned_scorer_id === user?.user_id;
  const isCompleted = room.match_status === 'COMPLETED';

  return (
    <ScrollView className="flex-1 bg-surface" testID="live-score-screen">
      <View className="px-6 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="font-ui font-bold text-title-xl text-ink-black">
            {room.match_name ?? 'Live Match'}
          </Text>
          {/* Module 2.9 slot — ViewerCountBadge fills this in. */}
          <ViewerCountBadge matchId={matchId} />
        </View>

        {live?.innings ? (
          <>
            <View className="bg-surface-alt rounded-lg border border-border-subtle p-5 mt-4">
              <Text className="font-ui font-bold text-stat-lg text-ink-black" testID="score-header">
                {live.innings.total_runs}/{live.innings.total_wickets}
              </Text>
              <Text className="font-ui text-body text-text-secondary mt-1">
                {live.innings.overs_completed} overs
              </Text>
              {live.innings.target_runs != null && (
                <View className="flex-row mt-3">
                  <Text className="font-ui text-micro text-text-tertiary mr-4">
                    Target: {live.innings.target_runs}
                  </Text>
                  <Text className="font-ui text-micro text-text-tertiary mr-4">
                    CRR: {live.current_run_rate}
                  </Text>
                  {live.required_run_rate != null && (
                    <Text className="font-ui text-micro text-brand-red">
                      RRR: {live.required_run_rate}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View className="flex-row mt-4" style={{ marginHorizontal: -6 }}>
              <View className="flex-1 bg-surface-alt rounded-md p-3 m-1.5">
                <Text className="font-ui text-micro uppercase text-text-tertiary mb-1">
                  Striker
                </Text>
                <Text className="font-ui font-semibold text-body text-ink-black">
                  {bfamIdFor(room.players, live.current_striker_player_id)}
                </Text>
              </View>
              <View className="flex-1 bg-surface-alt rounded-md p-3 m-1.5">
                <Text className="font-ui text-micro uppercase text-text-tertiary mb-1">
                  Non-Striker
                </Text>
                <Text className="font-ui font-semibold text-body text-ink-black">
                  {bfamIdFor(room.players, live.current_non_striker_player_id)}
                </Text>
              </View>
            </View>
            <View className="bg-surface-alt rounded-md p-3 mt-1">
              <Text className="font-ui text-micro uppercase text-text-tertiary mb-1">Bowler</Text>
              <Text className="font-ui font-semibold text-body text-ink-black">
                {bfamIdFor(room.players, live.current_bowler_player_id)}
              </Text>
            </View>
          </>
        ) : (
          <Text className="font-ui text-body text-text-secondary text-center mt-8">
            {isCompleted ? 'This match has finished.' : 'The innings has not started yet.'}
          </Text>
        )}

        <View className="mt-6">
          <Button
            label="Scorecard"
            variant="secondary"
            iconLeft={<Feather name="list" size={16} color="#D80000" />}
            onPress={() => router.push(`/(tabs)/matches/${matchId}/scorecard`)}
            testID="open-scorecard"
          />
        </View>

        {isCompleted && (
          <View className="mt-3">
            <Button
              label="Match Result"
              iconLeft={<Feather name="award" size={16} color="#FFFFFF" />}
              onPress={() => router.push(`/(tabs)/matches/${matchId}/result`)}
              testID="open-result"
            />
          </View>
        )}

        {isManager && !isCompleted && (
          <View className="mt-3">
            <Button
              label="Open Scoring Interface"
              variant="secondary"
              iconLeft={<Feather name="edit-3" size={16} color="#D80000" />}
              onPress={() => router.push(`/(tabs)/matches/${matchId}/scoring`)}
              testID="open-scoring"
            />
          </View>
        )}

        <View className="mb-10" />
      </View>
    </ScrollView>
  );
}
