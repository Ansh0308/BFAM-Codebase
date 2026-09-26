import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Referral } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { BallLoader } from '../src/components/BallLoader';

// Refer a Friend (long tail, PRD §12.53): the referral code is the
// player's own BFAM ID (see the referrals migration for why). A friend
// enters it at signup; the referrer earns coins once that friend
// completes their first match.
export default function ReferralsScreen() {
  const router = useRouter();
  const bfamId = useAuthStore((s) => s.user?.bfam_id);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getMyReferrals()
      .then((res) => setReferrals(res.results))
      .catch(() => setError('Could not load your referrals.'))
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
          testID="referrals-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Refer a Friend</Text>
      </View>

      <ScrollView className="flex-1 px-5" testID="referrals-screen">
        <View className="bg-surface-alt rounded-lg p-5 mb-6 items-center">
          <Text className="font-ui text-micro uppercase text-text-tertiary">
            Your referral code
          </Text>
          <Text
            className="font-ui font-bold text-title-xl text-brand-red mt-1"
            testID="referral-code"
          >
            {bfamId ?? '—'}
          </Text>
          <Text className="font-ui text-micro text-text-tertiary text-center mt-2">
            Earn coins when a friend signs up with your code and plays their first match.
          </Text>
          {bfamId && (
            <Pressable
              onPress={() =>
                Share.share({
                  message: `Join me on BFAM! Use my referral code ${bfamId} when you sign up.`,
                })
              }
              className="mt-3"
              testID="share-referral-code"
            >
              <Text className="font-ui font-bold text-body text-brand-red">Share code</Text>
            </Pressable>
          )}
        </View>

        {loading && <BallLoader testID="referrals-loading" />}
        {!loading && error && (
          <Text className="font-ui text-body text-text-secondary text-center">{error}</Text>
        )}
        {!loading && !error && referrals.length === 0 && (
          <Text
            className="font-ui text-body text-text-tertiary text-center"
            testID="referrals-empty"
          >
            No referrals yet — share your code!
          </Text>
        )}
        {!loading &&
          !error &&
          referrals.map((r) => (
            <View
              key={r.referral_id}
              className="flex-row items-center justify-between py-3 border-b border-border-subtle"
              testID={`referral-row-${r.referral_id}`}
            >
              <Text className="font-ui text-body text-text-primary">
                {r.referred_full_name || r.referred_bfam_id}
              </Text>
              <Text className="font-ui font-bold text-micro uppercase text-brand-red">
                {r.status === 'QUALIFIED' ? `+${r.reward_coins} coins` : 'Pending'}
              </Text>
            </View>
          ))}
        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
