import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { PublicPlayerProfile } from '@bfam/shared-types';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { colors } from '../src/theme/tokens';
import { apiClient } from '../src/lib/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { DISCOVERY_ENABLED } from '../src/config/featureFlags';

function displayName(p: PublicPlayerProfile): string {
  return p.full_name || p.bfam_id;
}

const FIELD_LABELS: { key: keyof PublicPlayerProfile; label: string }[] = [
  { key: 'playing_role', label: 'Playing Role' },
  { key: 'batting_style', label: 'Batting Style' },
  { key: 'bowling_style', label: 'Bowling Style' },
  { key: 'experience_level', label: 'Experience' },
  { key: 'favorite_cricketer_name', label: 'Favorite Cricketer' },
  { key: 'city', label: 'City' },
];

// Public Player Profile (backlog B-10) — reachable by tapping a player's
// avatar/name from a roster or team-member row. Read-only, and
// deliberately shows less than the Player's own Profile screen (module
// 2.2) — see getPublicProfile (backend) for exactly what's excluded.
export default function PlayerProfileScreen() {
  const router = useRouter();
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const myBfamId = useAuthStore((s) => s.user?.bfam_id);
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [bookTurfBusy, setBookTurfBusy] = useState(false);
  const [bookTurfError, setBookTurfError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getPlayerProfile(playerId)
      .then(setProfile)
      .catch(() => setError('Could not load this profile.'))
      .finally(() => setLoading(false));
  }, [playerId]);

  // Backlog B-9: follow/unfollow — hidden on your own profile (the
  // backend rejects self-follow anyway; hiding the button avoids a
  // confusing error for something that was never a real option).
  async function toggleFollow() {
    if (!profile) return;
    setFollowBusy(true);
    setFollowError(null);
    try {
      const result = profile.follow_summary.is_following
        ? await apiClient.unfollowPlayer(profile.player_id)
        : await apiClient.followPlayer(profile.player_id);
      setProfile({
        ...profile,
        follow_summary: {
          ...profile.follow_summary,
          is_following: result.following,
          followers_count: profile.follow_summary.followers_count + (result.following ? 1 : -1),
        },
      });
    } catch {
      setFollowError('Could not update follow status. Please try again.');
    } finally {
      setFollowBusy(false);
    }
  }

  // Backlog B-12 (feedback: a player reached via search should be able to
  // see "available turf for the booking" from their profile). Mirrors
  // Home's own bookTurf() exactly — same single-turf fallback while
  // Discover stays hidden (backlog A-12) — since this screen shouldn't
  // invent a second turf-picking behavior alongside Home's.
  async function bookTurf() {
    if (!DISCOVERY_ENABLED) {
      setBookTurfBusy(true);
      setBookTurfError(null);
      try {
        const { results } = await apiClient.getTurfs({});
        const turf = results[0];
        if (!turf) {
          setBookTurfError('No turf is available to book yet.');
          return;
        }
        router.push(
          `/(tabs)/discover/turf/${turf.turf_id}/availability?turfName=${encodeURIComponent(turf.turf_name)}`,
        );
      } catch {
        setBookTurfError('Could not load the turf. Please try again.');
      } finally {
        setBookTurfBusy(false);
      }
      return;
    }
    router.push('/(tabs)/discover');
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="player-profile-loading" />
        </View>
      </ScreenContainer>
    );
  }

  if (error || !profile) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Player Profile" />
        <Text
          className="font-ui text-body text-text-secondary text-center mt-8"
          testID="player-profile-error"
        >
          {error ?? 'Could not load this profile.'}
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader title="Player Profile" />
      <View className="items-center mt-4 mb-6" testID="player-profile-screen">
        <Avatar uri={profile.profile_photo_url} size={88} />
        <Text className="font-ui font-bold text-title-xl text-ink-black mt-3">
          {displayName(profile)}
        </Text>
        <Text className="font-ui text-body text-text-secondary">{profile.bfam_id}</Text>

        {/* Backlog B-9: follower/following counts + follow toggle —
            hidden on the viewer's own profile. */}
        <View className="flex-row mt-4" style={{ gap: 32 }}>
          <View className="items-center">
            <Text className="font-ui font-bold text-body text-ink-black">
              {profile.follow_summary.followers_count}
            </Text>
            <Text className="font-ui text-micro text-text-tertiary">Followers</Text>
          </View>
          <View className="items-center">
            <Text className="font-ui font-bold text-body text-ink-black">
              {profile.follow_summary.following_count}
            </Text>
            <Text className="font-ui text-micro text-text-tertiary">Following</Text>
          </View>
        </View>

        {myBfamId !== profile.bfam_id && (
          <View className="mt-4" style={{ width: 160 }}>
            <Button
              label={profile.follow_summary.is_following ? 'Following' : 'Follow'}
              variant={profile.follow_summary.is_following ? 'secondary' : 'primary'}
              onPress={toggleFollow}
              loading={followBusy}
              testID="follow-toggle-button"
            />
          </View>
        )}
        {followError && (
          <Text className="font-ui text-body text-brand-red-dark mt-2" testID="follow-error">
            {followError}
          </Text>
        )}

        <View className="mt-4" style={{ width: 200 }}>
          <Button
            label="Book a Turf"
            variant="secondary"
            iconLeft={<Feather name="calendar" size={16} color="#D80000" />}
            onPress={bookTurf}
            loading={bookTurfBusy}
            testID="player-profile-book-turf-button"
          />
        </View>
        {bookTurfError && (
          <Text className="font-ui text-body text-brand-red-dark mt-2" testID="book-turf-error">
            {bookTurfError}
          </Text>
        )}
      </View>

      <View className="flex-row justify-center mb-6" style={{ gap: 24 }}>
        <View className="items-center">
          <Text className="font-ui font-bold text-title-xl text-brand-red">
            {profile.skill_rating}
          </Text>
          <Text className="font-ui text-micro uppercase text-text-tertiary">Skill Rating</Text>
        </View>
        <View className="items-center">
          <Text className="font-ui font-bold text-title-xl text-brand-red">
            {Math.round(Number(profile.reliability_score))}
          </Text>
          <Text className="font-ui text-micro uppercase text-text-tertiary">Fair Play</Text>
        </View>
      </View>

      {FIELD_LABELS.map(({ key, label }) => {
        const value = profile[key];
        if (!value) return null;
        return (
          <View key={key} className="flex-row justify-between py-3 border-b border-border-subtle">
            <Text className="font-ui text-body text-text-secondary">{label}</Text>
            <Text className="font-ui text-body text-text-primary">{String(value)}</Text>
          </View>
        );
      })}
    </ScreenContainer>
  );
}
