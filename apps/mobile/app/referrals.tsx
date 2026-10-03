import React, { useCallback, useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import type { Referral } from '@bfam/shared-types';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { COIN_REFERRAL_REWARD } from '../src/components/coins/CoinsExplainer';
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
  type IconName,
} from '../src/components/hub/HubParts';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'share-variant', title: 'Share your code', body: 'Send your BFAM ID to a friend.' },
  {
    icon: 'account-group',
    title: 'They sign up with it',
    body: 'They enter the code when they create their account.',
  },
  {
    icon: 'trophy',
    title: `You earn ${COIN_REFERRAL_REWARD} coins`,
    body: 'As soon as they finish their first match.',
  },
];

// Refer a Friend (long tail, PRD §12.53): the referral code is the
// player's own BFAM ID (see the referrals migration for why). A friend
// enters it at signup; the referrer earns coins once that friend
// completes their first match.
export default function ReferralsScreen() {
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
    <HubScreen
      title="Refer a Friend"
      subtitle={`Earn ${COIN_REFERRAL_REWARD} coins for every friend who plays`}
      backTestID="referrals-back"
      testID="referrals-screen"
    >
      <HeroCard style={{ alignItems: 'center' }}>
        <Text
          className="font-ui"
          style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}
        >
          YOUR REFERRAL CODE
        </Text>
        <View
          style={{
            marginTop: 10,
            paddingHorizontal: 18,
            paddingVertical: 8,
            maxWidth: '100%',
            borderRadius: 12,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: 'rgba(255,255,255,0.7)',
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <Text
            className="font-display"
            style={{ fontSize: 28, lineHeight: 34, color: '#FFFFFF', letterSpacing: 1.5 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            testID="referral-code"
          >
            {bfamId ?? '—'}
          </Text>
        </View>
        <Text
          className="font-ui text-center"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 10 }}
        >
          Earn coins when a friend signs up with your code and plays their first match.
        </Text>
        {bfamId && (
          <View style={{ marginTop: 14 }}>
            <PillButton
              label="Share code"
              variant="outline"
              icon="share-2"
              onPress={() =>
                Share.share({
                  message: `Join me on BFAM! Use my referral code ${bfamId} when you sign up.`,
                })
              }
              testID="share-referral-code"
            />
          </View>
        )}
      </HeroCard>

      <SectionLabel>How it works</SectionLabel>
      <HubCard style={{ paddingVertical: 6 }}>
        {STEPS.map((s, i) => (
          <View
            key={s.title}
            className="flex-row items-center"
            style={{
              paddingVertical: 10,
              borderBottomWidth: i === STEPS.length - 1 ? 0 : 1,
              borderBottomColor: '#F1F1F1',
            }}
          >
            <IconBadge icon={s.icon} size={36} />
            <View className="flex-1" style={{ marginLeft: 12 }}>
              <Text className="font-ui font-bold text-ink-black" style={{ fontSize: 14 }}>
                {s.title}
              </Text>
              <Text className="font-ui text-text-secondary" style={{ fontSize: 12.5 }}>
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </HubCard>

      <SectionLabel>Your referrals</SectionLabel>
      {loading && <HubLoading testID="referrals-loading" />}
      {!loading && error && <HubMessage tone="error">{error}</HubMessage>}
      {!loading && !error && referrals.length === 0 && (
        <HubMessage icon="account-plus-outline" testID="referrals-empty">
          No referrals yet — share your code!
        </HubMessage>
      )}
      {!loading &&
        !error &&
        referrals.map((r) => (
          <HubCard
            key={r.referral_id}
            style={{ marginBottom: 8, paddingVertical: 12 }}
            testID={`referral-row-${r.referral_id}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-ui text-body text-text-primary flex-1" numberOfLines={1}>
                {r.referred_full_name || r.referred_bfam_id}
              </Text>
              <Chip
                text={r.status === 'QUALIFIED' ? `+${r.reward_coins} coins` : 'Pending'}
                tone={r.status === 'QUALIFIED' ? 'red' : 'muted'}
              />
            </View>
          </HubCard>
        ))}
    </HubScreen>
  );
}
