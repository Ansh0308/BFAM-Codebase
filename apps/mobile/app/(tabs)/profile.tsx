import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MyProfile } from '@bfam/shared-types';
import { Avatar } from '../../src/components/Avatar';
import { BfamIdBadge } from '../../src/components/BfamIdBadge';
import { apiClient } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/store/authStore';

const PLAYING_ROLE_LABELS: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-Rounder',
  WICKET_KEEPER: 'Wicket-Keeper',
};
const BATTING_STYLE_LABELS: Record<string, string> = {
  RIGHT_HANDED: 'Right-Handed',
  LEFT_HANDED: 'Left-Handed',
};
const BOWLING_ARM_LABELS: Record<string, string> = {
  LEFT_ARM: 'Left-Arm',
  RIGHT_ARM: 'Right-Arm',
};
const EXPERIENCE_LABELS: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

// Player Profile (public view) — Module 2.2. Stats and Ratings are
// placeholder slots only (real data lands in Module 2.10); everything
// else here is real, persisted profile data from GET /profile/me.
export default function Profile() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiClient.getMyProfile();
      setProfile(data);
    } catch {
      // Leave `profile` as-is; the screen still renders with what it has.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const isPlayer = (profile?.role ?? authUser?.role) === 'PLAYER';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1 px-5"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadProfile} tintColor="#D80000" />
        }
        testID="profile-screen"
      >
        <View className="flex-row justify-end mt-4">
          <Pressable
            onPress={() => router.push('/profile-settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Profile settings"
            testID="profile-settings-button"
          >
            <Feather name="settings" size={22} color="#0D0D0D" />
          </Pressable>
        </View>

        <View className="items-center mt-2 mb-6">
          <Avatar uri={profile?.profile_photo_url} size={96} />
          {profile?.bfam_id ? (
            <View className="mt-3">
              <BfamIdBadge bfamId={profile.bfam_id} size="lg" />
            </View>
          ) : null}
          <Text className="font-ui text-body text-text-secondary mt-1">
            {profile?.phone_number ?? authUser?.user_id ?? ''}
          </Text>

          <Pressable
            onPress={() => router.push('/profile-setup')}
            className="flex-row items-center mt-3 border border-border-strong rounded-md px-4 py-2"
            testID="edit-profile-button"
          >
            <Feather name="edit-2" size={14} color="#D80000" />
            <Text className="font-ui text-micro uppercase tracking-wide text-brand-red ml-2">
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {isPlayer ? (
          <>
            {profile?.favorite_cricketer_name ? (
              <View className="flex-row items-center bg-surface-alt rounded-lg p-4 mb-4">
                <Feather name="star" size={18} color="#D80000" />
                <View className="ml-3">
                  <Text className="font-ui text-micro uppercase tracking-wide text-text-tertiary">
                    Favorite Cricketer
                  </Text>
                  <Text className="font-ui font-bold text-body text-text-primary mt-0.5">
                    {profile.favorite_cricketer_name}
                  </Text>
                </View>
              </View>
            ) : null}

            <View className="flex-row flex-wrap mb-6" style={{ marginHorizontal: -6 }}>
              <ProfileFact
                label="Playing Role"
                value={profile?.playing_role ? PLAYING_ROLE_LABELS[profile.playing_role] : '—'}
              />
              <ProfileFact
                label="Batting Style"
                value={profile?.batting_style ? BATTING_STYLE_LABELS[profile.batting_style] : '—'}
              />
              <ProfileFact
                label="Bowling Style"
                value={profile?.bowling_style ? BOWLING_ARM_LABELS[profile.bowling_style] : '—'}
              />
              <ProfileFact
                label="Experience"
                value={
                  profile?.experience_level ? EXPERIENCE_LABELS[profile.experience_level] : '—'
                }
              />
            </View>

            <PlaceholderSection
              icon="bar-chart-2"
              title="Career Stats"
              note="Matches, runs, wickets, and more — coming in a later module."
              testID="stats-placeholder"
            />
            <PlaceholderSection
              icon="award"
              title="Ratings"
              note="Skill Rating, Fair Play, Reliability, and Community Rating — coming in a later module."
              testID="ratings-placeholder"
            />
          </>
        ) : (
          <Text className="font-ui text-body text-text-tertiary text-center mt-4">
            {profile?.role === 'TURF_OWNER'
              ? 'Turf Owner'
              : profile?.role === 'TURF_STAFF'
                ? 'Turf Staff'
                : ''}{' '}
            account — BFAM IDs, stats, and ratings are for players only.
          </Text>
        )}

        <Pressable
          onPress={() => clearSession().then(() => router.replace('/login'))}
          className="flex-row items-center justify-center mt-6 mb-10"
          testID="logout-button"
        >
          <Feather name="log-out" size={16} color="#767676" />
          <Text className="font-ui text-body text-text-tertiary ml-2">Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingHorizontal: 6 }} className="mb-3">
      <View className="bg-surface border border-border-subtle rounded-md p-3">
        <Text className="font-ui text-micro uppercase tracking-wide text-text-tertiary">
          {label}
        </Text>
        <Text className="font-ui font-bold text-body text-text-primary mt-1">{value}</Text>
      </View>
    </View>
  );
}

function PlaceholderSection({
  icon,
  title,
  note,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  note: string;
  testID?: string;
}) {
  return (
    <View className="bg-surface-alt rounded-lg p-5 mb-4 items-center" testID={testID}>
      <Feather name={icon} size={24} color="#D80000" />
      <Text className="font-display text-card-title uppercase text-ink-black mt-2">{title}</Text>
      <Text className="font-ui text-body text-text-tertiary text-center mt-1">{note}</Text>
    </View>
  );
}
