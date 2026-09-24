import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Membership, MembershipPlan } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';
import { confirmAction } from '../src/lib/confirm';
import { colors } from '../src/theme/tokens';

// Memberships (long tail, PRD §12.51): plans bought with coins; buying while
// active extends from the current expiry.
export default function MembershipScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.getMembershipPlans(),
      apiClient.getMyMembership(),
      apiClient.getMyProfile(),
    ])
      .then(([p, mine, profile]) => {
        setPlans(p.results);
        setMembership(mine.membership);
        setCoins(profile.coin_balance);
      })
      .catch(() => setError('Could not load membership plans.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function subscribe(plan: MembershipPlan) {
    const ok = await confirmAction(
      'Buy membership?',
      `Spend ${plan.coin_cost} coins on ${plan.name} (${plan.duration_days} days)?`,
      'Buy',
    );
    if (!ok) return;
    setBusyId(plan.plan_id);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.subscribeToMembership(plan.plan_id);
      setCoins(res.coin_balance);
      setMessage(
        `You're a ${res.plan_name} until ${new Date(res.expires_at).toLocaleDateString()}.`,
      );
      const mine = await apiClient.getMyMembership();
      setMembership(mine.membership);
    } catch (err) {
      setError(err instanceof BFAMApiError ? err.message : 'Could not buy that membership.');
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
          testID="membership-back"
        >
          <Feather name="arrow-left" size={22} color="#0D0D0D" />
        </Pressable>
        <Text className="font-ui font-bold text-title-xl text-ink-black ml-3">Membership</Text>
      </View>

      <ScrollView className="flex-1 px-5" testID="membership-screen">
        {coins !== null && (
          <Text className="font-ui text-body text-text-secondary mb-4" testID="membership-coins">
            Your balance: {coins} coins
          </Text>
        )}
        {membership && (
          <View className="bg-surface-alt rounded-lg p-4 mb-4" testID="membership-active">
            <Text className="font-ui font-bold text-body text-ink-black">
              {membership.plan_name} · {membership.discount_percent}% member discount
            </Text>
            <Text className="font-ui text-micro text-text-tertiary mt-1">
              Active until {new Date(membership.expires_at).toLocaleDateString()}
            </Text>
          </View>
        )}
        {message && <Text className="font-ui text-body text-ink-black mb-3">{message}</Text>}
        {error && <Text className="font-ui text-body text-brand-red mb-3">{error}</Text>}
        {loading && (
          <ActivityIndicator size="large" color={colors.brandRed} testID="membership-loading" />
        )}

        {!loading &&
          plans.map((p) => {
            const cantAfford = coins !== null && coins < p.coin_cost;
            return (
              <View
                key={p.plan_id}
                className="bg-surface-alt rounded-lg p-4 mb-3"
                testID={`plan-${p.plan_id}`}
              >
                <Text className="font-ui font-bold text-body text-ink-black">{p.name}</Text>
                <Text className="font-ui text-micro text-text-tertiary mt-1">
                  {p.duration_days} days · {p.discount_percent}% discount
                </Text>
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="font-ui font-bold text-body text-brand-red">
                    {p.coin_cost} coins
                  </Text>
                  <Pressable
                    onPress={() => subscribe(p)}
                    disabled={busyId === p.plan_id || cantAfford}
                    testID={`subscribe-${p.plan_id}`}
                  >
                    <Text
                      className={`font-ui font-bold text-body uppercase ${
                        cantAfford ? 'text-text-tertiary' : 'text-brand-red'
                      }`}
                    >
                      {membership ? 'Extend' : 'Join'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        <View className="mb-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
