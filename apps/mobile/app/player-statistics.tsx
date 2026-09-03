import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { PlayerStatistics, StatisticsScope } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const SCOPES: { value: StatisticsScope; label: string }[] = [
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'season', label: 'Season' },
];

// Player Statistics screen (module 2.10, PRD §12.32) — replaces the "Career
// Stats" placeholder on Player Profile (module 2.2). `playerId` defaults to
// "me" (the viewer's own stats); a real player_id can be passed to view a
// teammate's.
export default function PlayerStatisticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ playerId?: string }>();
  const playerId = params.playerId ?? 'me';

  const [scope, setScope] = useState<StatisticsScope>('lifetime');
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getPlayerStatistics(playerId, scope)
      .then(setStats)
      .catch(() => setError('Could not load statistics.'))
      .finally(() => setLoading(false));
  }, [playerId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="flex-row items-center px-5 pt-4 mb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="player-statistics-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Statistics</Text>
      </View>

      <View className="flex-row px-5 mb-4" testID="statistics-scope-toggle">
        {SCOPES.map((s) => {
          const selected = s.value === scope;
          return (
            <Pressable
              key={s.value}
              onPress={() => setScope(s.value)}
              className={`flex-1 items-center py-2 mr-2 rounded-md border ${
                selected ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'
              }`}
              testID={`statistics-scope-${s.value}`}
            >
              <Text
                className={`font-ui font-bold text-body ${selected ? 'text-surface' : 'text-text-primary'}`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-5" testID="player-statistics-screen">
        {loading && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color={colors.brandRed} testID="statistics-loading" />
          </View>
        )}

        {!loading && error && (
          <Text className="font-ui text-body text-text-secondary text-center mt-6">{error}</Text>
        )}

        {!loading && !error && stats && (
          <>
            {stats.matches_played === 0 ? (
              <Text
                className="font-ui text-body text-text-tertiary text-center mt-8"
                testID="statistics-empty"
              >
                {scope === 'season'
                  ? 'No matches played this season yet.'
                  : 'No completed matches yet — stats appear here once you finish one.'}
              </Text>
            ) : (
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                <StatTile label="Matches" value={String(stats.matches_played)} />
                <StatTile label="Runs" value={String(stats.runs)} />
                <StatTile label="Wickets" value={String(stats.wickets)} />
                <StatTile
                  label="Best Score"
                  value={stats.best_score != null ? String(stats.best_score) : '—'}
                />
                <StatTile
                  label="Strike Rate"
                  value={stats.strike_rate != null ? stats.strike_rate.toFixed(2) : '—'}
                />
                <StatTile
                  label="Economy"
                  value={stats.economy != null ? stats.economy.toFixed(2) : '—'}
                />
                <StatTile label="Catches" value={String(stats.catches)} />
                <StatTile
                  label="Player of the Match"
                  value={String(stats.player_of_the_match_count)}
                />
                {scope === 'season' && (
                  <StatTile label="Current Streak" value={String(stats.current_streak ?? 0)} />
                )}
              </View>
            )}
          </>
        )}

        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingHorizontal: 6 }} className="mb-3">
      <View className="bg-surface-alt rounded-md p-4">
        <Text className="font-ui text-micro uppercase tracking-wide text-text-tertiary">
          {label}
        </Text>
        <Text className="font-ui font-bold text-stat-lg text-ink-black mt-1">{value}</Text>
      </View>
    </View>
  );
}
