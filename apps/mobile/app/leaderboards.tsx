import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { LeaderboardCategory, LeaderboardEntry } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const CATEGORIES: { value: LeaderboardCategory; label: string }[] = [
  { value: 'MOST_RUNS', label: 'Most Runs' },
  { value: 'MOST_WICKETS', label: 'Most Wickets' },
  { value: 'MOST_SIXES', label: 'Most Sixes' },
  { value: 'BEST_STRIKE_RATE', label: 'Best Strike Rate' },
  { value: 'BEST_ECONOMY', label: 'Best Economy' },
  { value: 'HIGHEST_SKILL_RATING', label: 'Skill Rating' },
  { value: 'FAIR_PLAY', label: 'Fair Play' },
  { value: 'RELIABILITY', label: 'Reliability' },
];

// Rankings & Leaderboards (long tail, PRD §12.33) — see leaderboardService.ts
// for exactly which categories this first cut covers and why.
export default function LeaderboardsScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<LeaderboardCategory>('MOST_RUNS');
  const [results, setResults] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getLeaderboard(category)
      .then((res) => setResults(res.results))
      .catch(() => setError('Could not load the leaderboard.'))
      .finally(() => setLoading(false));
  }, [category]);

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
          testID="leaderboards-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Leaderboards</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 mb-4"
        testID="leaderboard-category-scroll"
      >
        {CATEGORIES.map((c) => {
          const selected = c.value === category;
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              className={`items-center py-2 px-4 mr-2 rounded-md border ${
                selected ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong'
              }`}
              testID={`leaderboard-category-${c.value}`}
            >
              <Text
                className={`font-ui font-bold text-body ${selected ? 'text-surface' : 'text-text-primary'}`}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView className="flex-1 px-5" testID="leaderboards-screen">
        {loading && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color={colors.brandRed} testID="leaderboards-loading" />
          </View>
        )}

        {!loading && error && (
          <Text className="font-ui text-body text-text-secondary text-center mt-6">{error}</Text>
        )}

        {!loading && !error && results.length === 0 && (
          <Text
            className="font-ui text-body text-text-tertiary text-center mt-8"
            testID="leaderboards-empty"
          >
            No qualifying players yet for this leaderboard.
          </Text>
        )}

        {!loading &&
          !error &&
          results.map((entry) => (
            <View
              key={entry.player_id}
              className="flex-row items-center justify-between py-3 border-b border-border-subtle"
              testID={`leaderboard-row-${entry.player_id}`}
            >
              <View className="flex-row items-center">
                <Text className="font-ui font-bold text-body text-text-tertiary w-8">
                  {entry.rank}
                </Text>
                <Text className="font-ui text-body text-text-primary">
                  {entry.full_name || entry.bfam_id}
                </Text>
              </View>
              <Text className="font-ui font-bold text-body text-ink-black">{entry.value}</Text>
            </View>
          ))}

        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
