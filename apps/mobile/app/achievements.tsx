import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { AchievementStatus } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

// Achievements & Badges (long tail, PRD §12.37) — see
// domain/achievements.ts for exactly which badges this first cut covers
// and their unlock criteria.
export default function AchievementsScreen() {
  const router = useRouter();
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getPlayerAchievements('me')
      .then((res) => setAchievements(res.results))
      .catch(() => setError('Could not load your achievements.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="flex-row items-center px-5 pt-4 mb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="achievements-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Achievements</Text>
      </View>

      {!loading && !error && (
        <Text
          className="font-ui text-body text-text-tertiary px-5 mb-4"
          testID="achievements-count"
        >
          {earnedCount} of {achievements.length} earned
        </Text>
      )}

      <ScrollView className="flex-1 px-5" testID="achievements-screen">
        {loading && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color={colors.brandRed} testID="achievements-loading" />
          </View>
        )}

        {!loading && error && (
          <Text className="font-ui text-body text-text-secondary text-center mt-6">{error}</Text>
        )}

        {!loading &&
          !error &&
          achievements.map((a) => (
            <View
              key={a.id}
              className={`flex-row items-center py-3 border-b border-border-subtle ${
                a.earned ? '' : 'opacity-40'
              }`}
              testID={`achievement-row-${a.id}`}
            >
              <Feather
                name={a.earned ? 'award' : 'lock'}
                size={22}
                color={a.earned ? colors.brandRed : colors.textTertiary}
              />
              <View className="ml-3 flex-1">
                <Text className="font-ui font-bold text-body text-ink-black">{a.name}</Text>
                <Text className="font-ui text-micro text-text-tertiary mt-0.5">
                  {a.description}
                </Text>
              </View>
            </View>
          ))}

        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
