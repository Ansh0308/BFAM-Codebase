import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Reward, RewardRedemption } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';
import { confirmAction } from '../src/lib/confirm';
import { colors } from '../src/theme/tokens';
import { CoinsExplainer } from '../src/components/coins/CoinsExplainer';
import {
  Chip,
  HeroCard,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  PillButton,
  SectionLabel,
} from '../src/components/hub/HubParts';

// Rewards (long tail, PRD §12.36): a coin-priced catalog. Redeeming spends
// coins and creates a PENDING redemption a turf/admin fulfils manually.
export default function RewardsScreen() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(true);

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
    <HubScreen
      title="Rewards"
      subtitle="Spend your BFAM Coins"
      backTestID="rewards-back"
      testID="rewards-screen"
    >
      {coins !== null && (
        <HeroCard>
          <Text
            className="font-ui"
            style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
          >
            YOUR BALANCE
          </Text>
          <Text
            className="font-display"
            style={{ fontSize: 44, lineHeight: 50, color: '#FFFFFF', marginTop: 2 }}
            testID="rewards-coins"
          >
            {coins} coins
          </Text>
          <Text className="font-ui" style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>
            Worth ₹{coins} off your next turf booking
          </Text>
        </HeroCard>
      )}

      <Pressable
        onPress={() => setHowOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: howOpen }}
        testID="coins-how-toggle"
        className="flex-row items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <SectionLabel>How BFAM Coins work</SectionLabel>
        <Feather name={howOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.inkBlack} />
      </Pressable>
      {howOpen && <CoinsExplainer testID="coins-explainer" />}

      <SectionLabel>Rewards you can get</SectionLabel>

      {message && <HubMessage tone="ok">{message}</HubMessage>}
      {error && <HubMessage tone="error">{error}</HubMessage>}
      {loading && <HubLoading testID="rewards-loading" />}

      {!loading && !error && rewards.length === 0 && (
        <HubMessage icon="gift-outline">
          No rewards in the catalog yet — check back soon.
        </HubMessage>
      )}

      {!loading &&
        rewards.map((r) => {
          const cantAfford = coins !== null && coins < r.coin_cost;
          return (
            <HubCard key={r.reward_id} testID={`reward-${r.reward_id}`}>
              <View className="flex-row items-start">
                <IconBadge icon="gift" size={40} />
                <View className="flex-1" style={{ marginLeft: 12 }}>
                  <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 15 }}>
                    {r.name}
                  </Text>
                  {r.description && (
                    <Text
                      className="font-ui text-text-tertiary"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {r.description}
                    </Text>
                  )}
                </View>
              </View>
              <View className="flex-row items-center justify-between" style={{ marginTop: 12 }}>
                <Text className="font-display text-brand-red" style={{ fontSize: 22 }}>
                  {r.coin_cost} coins
                </Text>
                <PillButton
                  label="Redeem"
                  onPress={() => redeem(r)}
                  disabled={busyId === r.reward_id || cantAfford}
                  testID={`redeem-${r.reward_id}`}
                />
              </View>
              {cantAfford && coins !== null && (
                <Text
                  className="font-ui text-text-tertiary"
                  style={{ fontSize: 11.5, marginTop: 8 }}
                >
                  You need {r.coin_cost - coins} more coins.
                </Text>
              )}
            </HubCard>
          );
        })}

      {!loading && redemptions.length > 0 && (
        <>
          <SectionLabel>My Redemptions</SectionLabel>
          {redemptions.map((x) => (
            <HubCard
              key={x.redemption_id}
              style={{ marginBottom: 8, paddingVertical: 12 }}
              testID={`redemption-${x.redemption_id}`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-ui text-body text-text-primary flex-1">{x.reward_name}</Text>
                <Chip text={x.status} tone={x.status === 'PENDING' ? 'muted' : 'red'} />
              </View>
            </HubCard>
          ))}
        </>
      )}
    </HubScreen>
  );
}
