import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { RecognitionAward, RecognitionAwardType } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const AWARD_LABELS: Record<
  RecognitionAwardType,
  { title: string; unit: string; singular?: string }
> = {
  PLAYER_OF_THE_MONTH: { title: 'Player of the Month', unit: 'pts' },
  BATTING_STAR: { title: 'Batting Star', unit: 'runs' },
  BOWLING_STAR: { title: 'Bowling Star', unit: 'wickets', singular: 'wicket' },
  SPORTSMAN_OF_THE_MONTH: { title: 'Sportsman of the Month', unit: 'fair-play rating' },
};

// "YYYY-MM" plus/minus n months (UTC-safe).
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// Special Recognition (long tail, PRD §12.39) — monthly awards; see
// recognitionService.ts (backend) for exactly how each is decided.
export default function RecognitionScreen() {
  const router = useRouter();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [awards, setAwards] = useState<RecognitionAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getMonthlyRecognition(month)
      .then((res) => setAwards(res.awards))
      .catch(() => setError('Could not load recognition.'))
      .finally(() => setLoading(false));
  }, [month]);

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
          testID="recognition-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Recognition</Text>
      </View>

      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} testID="recognition-prev">
          <Feather name="chevron-left" size={24} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-body text-ink-black" testID="recognition-month">
          {month}
        </Text>
        <Pressable
          onPress={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= currentMonth}
          testID="recognition-next"
        >
          <Feather
            name="chevron-right"
            size={24}
            color={month >= currentMonth ? '#B0B0B0' : '#0D0D0D'}
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" testID="recognition-screen">
        {error && <Text className="font-ui text-body text-brand-red mb-3">{error}</Text>}
        {loading && (
          <ActivityIndicator size="large" color={colors.brandRed} testID="recognition-loading" />
        )}
        {!loading && !error && awards.length === 0 && (
          <Text className="font-ui text-body text-text-tertiary">
            No awards for this month yet. Play a completed match to be in the running.
          </Text>
        )}
        {!loading &&
          awards.map((a) => (
            <View
              key={a.award}
              className="bg-surface-alt rounded-lg p-4 mb-3"
              testID={`award-${a.award}`}
            >
              <Text className="font-ui font-bold text-micro uppercase text-text-secondary">
                {AWARD_LABELS[a.award].title}
              </Text>
              <Text className="font-ui font-bold text-body text-ink-black mt-1">
                {a.full_name ?? a.bfam_id}
              </Text>
              <Text className="font-ui text-micro text-text-tertiary mt-1">
                {a.value}{' '}
                {a.value === 1 && AWARD_LABELS[a.award].singular
                  ? AWARD_LABELS[a.award].singular
                  : AWARD_LABELS[a.award].unit}
              </Text>
            </View>
          ))}
        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
