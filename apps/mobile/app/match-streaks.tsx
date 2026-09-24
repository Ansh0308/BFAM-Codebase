import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { MatchStreaks } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

// Match Streaks (long tail, PRD §12.38) — "tracks consecutive
// participation to encourage regular play." Weekly-participation based,
// NOT a win streak (see domain/matchStreaks.ts for the reasoning, and
// Achievements' separate MATCH_STREAK win-based badge for the distinction).
export default function MatchStreaksScreen() {
  const router = useRouter();
  const [streaks, setStreaks] = useState<MatchStreaks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getPlayerMatchStreaks('me')
      .then(setStreaks)
      .catch(() => setError('Could not load your match streaks.'))
      .finally(() => setLoading(false));
  }, []);

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
          testID="match-streaks-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Match Streaks</Text>
      </View>

      <ScrollView className="flex-1 px-5" testID="match-streaks-screen">
        {loading && (
          <View className="py-10 items-center">
            <ActivityIndicator
              size="large"
              color={colors.brandRed}
              testID="match-streaks-loading"
            />
          </View>
        )}

        {!loading && error && (
          <Text className="font-ui text-body text-text-secondary text-center mt-6">{error}</Text>
        )}

        {!loading && !error && streaks && (
          <View className="flex-row" style={{ marginHorizontal: -6 }}>
            <View style={{ width: '50%', paddingHorizontal: 6 }}>
              <View className="bg-surface-alt rounded-lg p-5 items-center">
                <Text className="font-ui text-micro uppercase text-text-tertiary">
                  Current Streak
                </Text>
                <Text
                  className="font-ui font-bold text-title-xl text-brand-red mt-1"
                  testID="current-streak-value"
                >
                  {streaks.current_streak}
                </Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  week{streaks.current_streak === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <View style={{ width: '50%', paddingHorizontal: 6 }}>
              <View className="bg-surface-alt rounded-lg p-5 items-center">
                <Text className="font-ui text-micro uppercase text-text-tertiary">Best Streak</Text>
                <Text
                  className="font-ui font-bold text-title-xl text-ink-black mt-1"
                  testID="best-streak-value"
                >
                  {streaks.best_streak}
                </Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  week{streaks.best_streak === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!loading && !error && streaks && streaks.current_streak === 0 && (
          <Text
            className="font-ui text-body text-text-tertiary text-center mt-6"
            testID="match-streaks-encouragement"
          >
            Play a match this week to start a new streak!
          </Text>
        )}

        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
