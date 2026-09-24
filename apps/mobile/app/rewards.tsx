import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Reward, RewardRedemption } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';
import { confirmAction } from '../src/lib/confirm';
import { colors } from '../src/theme/tokens';

// Rewards (long tail, PRD §12.36): a coin-priced catalog. Redeeming spends
// coins and creates a PENDING redemption a turf/admin fulfils manually.
export default function RewardsScreen() {
  const router = useRouter();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([apiClient.getRewards(), apiClient.getMyRedemptions(), apiClient.getMyProfile()])
      .then(([r, red, profile]) => {
        setRewards(r.results);
        setRedemptions(red.results);
        setCoins(profile.coin_balance);
      })
      .catch(() => setError('Could not load rewards.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function redeem(reward: Reward) {
    const ok = await confirmAction(
      'Redeem reward?',
      `Spend ${reward.coin_cost} coins on "${reward.name}"?`,
      'Redeem',
    );
    if (!ok) return;
    setBusyId(reward.reward_id);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.redeemReward(reward.reward_id);
      setCoins(res.coin_balance);
      setMessage(`Redeemed "${res.reward_name}". It will be fulfilled shortly.`);
      const red = await apiClient.getMyRedemptions();
      setRedemptions(red.results);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not redeem that reward.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="flex-row items-center px-5 pt-4 mb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="rewards-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Rewards</Text>
      </View>

      <ScrollView className="flex-1 px-5" testID="rewards-screen">
        {coins !== null && (
          <Text className="font-ui text-body text-text-secondary mb-4" testID="rewards-coins">
            Your balance: {coins} coins
          </Text>
        )}
        {message && <Text className="font-ui text-body text-ink-black mb-3">{message}</Text>}
        {error && <Text className="font-ui text-body text-brand-red mb-3">{error}</Text>}
        {loading && (
          <ActivityIndicator size="large" color={colors.brandRed} testID="rewards-loading" />
        )}

        {!loading &&
          rewards.map((r) => {
            const cantAfford = coins !== null && coins < r.coin_cost;
            return (
              <View
                key={r.reward_id}
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`reward-${r.reward_id}`}
              >
                <Text className="font-ui font-bold text-body text-ink-black">{r.name}</Text>
                {r.description && (
                  <Text className="font-ui text-micro text-text-tertiary mt-1">
                    {r.description}
                  </Text>
                )}
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="font-ui font-bold text-body text-brand-red">
                    {r.coin_cost} coins
                  </Text>
                  <Pressable
                    onPress={() => redeem(r)}
                    disabled={busyId === r.reward_id || cantAfford}
                    testID={`redeem-${r.reward_id}`}
                  >
                    <Text
                      className={`font-ui font-bold text-body uppercase ${
                        cantAfford ? 'text-text-tertiary' : 'text-brand-red'
                      }`}
                    >
                      Redeem
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

        {!loading && redemptions.length > 0 && (
          <>
            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-4 mb-2">
              My Redemptions
            </Text>
            {redemptions.map((x) => (
              <View
                key={x.redemption_id}
                className="flex-row justify-between py-3 border-b border-border-subtle"
                testID={`redemption-${x.redemption_id}`}
              >
                <Text className="font-ui text-body text-text-primary">{x.reward_name}</Text>
                <Text className="font-ui text-micro uppercase text-text-tertiary">{x.status}</Text>
              </View>
            ))}
          </>
        )}
        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
