import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { LevelProgress, XpTransaction } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { colors } from '../src/theme/tokens';

const XP_REASON_LABELS: Record<string, string> = {
  REVIEW_REWARD: 'Submitted a review',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

// XP & Player Levels (long tail, PRD §12.35) — a separate progression
// system from BFAM Coins. See xpService.ts for the level thresholds and
// which events grant XP in this first cut.
export default function XpLevelScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [history, setHistory] = useState<XpTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([apiClient.getPlayerLevel('me'), apiClient.getPlayerXpHistory('me')])
      .then(([progressRes, historyRes]) => {
        setProgress(progressRes);
        setHistory(historyRes.results);
      })
      .catch(() => setError('Could not load your level and XP.'))
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
          testID="xp-level-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Level &amp; XP</Text>
      </View>

      <ScrollView className="flex-1 px-5" testID="xp-level-screen">
        {loading && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color={colors.brandRed} testID="xp-level-loading" />
          </View>
        )}

        {!loading && error && (
          <Text className="font-ui text-body text-text-secondary text-center mt-6">{error}</Text>
        )}

        {!loading && !error && progress && (
          <>
            <View className="bg-surface-alt rounded-lg p-5 mb-6 items-center" testID="level-card">
              <Text
                className="font-ui font-bold text-title-xl text-brand-red uppercase"
                testID="level-name"
              >
                {progress.level}
              </Text>
              <Text className="font-ui text-body text-text-tertiary mt-1" testID="xp-total">
                {progress.xp_total} XP
              </Text>

              {progress.next_level ? (
                <>
                  <View className="w-full bg-surface rounded-full h-3 mt-4 overflow-hidden">
                    <View
                      className="bg-brand-red h-3"
                      style={{ width: `${progress.progress_percent}%` }}
                      testID="xp-progress-bar"
                    />
                  </View>
                  <Text className="font-ui text-micro text-text-tertiary mt-2">
                    {progress.xp_into_level} / {progress.xp_for_next_level} XP to{' '}
                    {progress.next_level}
                  </Text>
                </>
              ) : (
                <Text className="font-ui text-micro text-text-tertiary mt-4">
                  Max level reached
                </Text>
              )}
            </View>

            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
              XP History
            </Text>
            {history.length === 0 ? (
              <Text
                className="font-ui text-body text-text-tertiary text-center mt-4"
                testID="xp-history-empty"
              >
                No XP earned yet.
              </Text>
            ) : (
              history.map((entry) => (
                <View
                  key={entry.xp_transaction_id}
                  className="flex-row items-center justify-between py-3 border-b border-border-subtle"
                  testID={`xp-history-row-${entry.xp_transaction_id}`}
                >
                  <Text className="font-ui text-body text-text-primary">
                    {XP_REASON_LABELS[entry.reason] ?? entry.reason}
                  </Text>
                  <Text className="font-ui font-bold text-body text-brand-red">
                    +{entry.amount}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
