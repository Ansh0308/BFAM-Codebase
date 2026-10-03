import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Membership, MembershipPlan } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';
import { confirmAction } from '../src/lib/confirm';
import {
  HeroCard,
  HubCard,
  HubLoading,
  HubMessage,
  HubScreen,
  IconBadge,
  PillButton,
  SectionLabel,
} from '../src/components/hub/HubParts';

// Memberships (long tail, PRD §12.51): plans bought with coins; buying while
// active extends from the current expiry.
export default function MembershipScreen() {
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
    <HubScreen
      title="Membership"
      subtitle="Pay with coins, save on every booking"
      backTestID="membership-back"
      testID="membership-screen"
    >
      {membership ? (
        <HeroCard testID="membership-active">
          <Text
            className="font-ui"
            style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
          >
            YOUR MEMBERSHIP
          </Text>
          <Text
            className="font-ui font-bold"
            style={{ fontSize: 22, lineHeight: 28, color: '#FFFFFF', marginTop: 4 }}
          >
            {membership.plan_name} · {membership.discount_percent}% member discount
          </Text>
          <Text
            className="font-ui"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}
          >
            Active until {new Date(membership.expires_at).toLocaleDateString()}
          </Text>
        </HeroCard>
      ) : null}

      {coins !== null && (
        <HubCard style={{ paddingVertical: 12 }}>
          <View className="flex-row items-center">
            <IconBadge icon="trophy" size={34} />
            <Text
              className="font-ui font-bold text-ink-black flex-1"
              style={{ fontSize: 15, marginLeft: 12 }}
              testID="membership-coins"
            >
              Your balance: {coins} coins
            </Text>
          </View>
        </HubCard>
      )}

      {message && <HubMessage tone="ok">{message}</HubMessage>}
      {error && <HubMessage tone="error">{error}</HubMessage>}
      {loading && <HubLoading testID="membership-loading" />}

      {!loading && plans.length > 0 && <SectionLabel>Plans</SectionLabel>}

      {!loading &&
        plans.map((p) => {
          const cantAfford = coins !== null && coins < p.coin_cost;
          return (
            <HubCard key={p.plan_id} testID={`plan-${p.plan_id}`}>
              <View className="flex-row items-start">
                <IconBadge icon="card-account-details" size={40} />
                <View className="flex-1" style={{ marginLeft: 12 }}>
                  <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 16 }}>
                    {p.name}
                  </Text>
                  <Text
                    className="font-ui text-text-tertiary"
                    style={{ fontSize: 12, marginTop: 2 }}
                  >
                    {p.duration_days} days · {p.discount_percent}% discount
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between" style={{ marginTop: 12 }}>
                <Text className="font-display text-brand-red" style={{ fontSize: 22 }}>
                  {p.coin_cost} coins
                </Text>
                <PillButton
                  label={membership ? 'Extend' : 'Join'}
                  onPress={() => subscribe(p)}
                  disabled={busyId === p.plan_id || cantAfford}
                  testID={`subscribe-${p.plan_id}`}
                />
              </View>
              {cantAfford && coins !== null && (
                <Text
                  className="font-ui text-text-tertiary"
                  style={{ fontSize: 11.5, marginTop: 8 }}
                >
                  You need {p.coin_cost - coins} more coins. Earn them by reviewing matches and
                  referring friends.
                </Text>
              )}
            </HubCard>
          );
        })}
    </HubScreen>
  );
}
