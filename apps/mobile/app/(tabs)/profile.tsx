import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { MyProfile } from '@bfam/shared-types';
import { Avatar } from '../../src/components/Avatar';
import { CricketBallIcon } from '../../src/components/CricketBallIcon';
import { Reveal } from '../../src/components/Reveal';
import { apiClient } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/store/authStore';
import {
  EditProfileButton,
  FavoriteCricketerCard,
  FollowStat,
  HubCard,
  PlayerDetailTile,
  RingFrame,
  SectionTitle,
  SkillRatingCard,
} from '../../src/components/profile/ProfileParts';
import profileBg from '../../src/assets/images/profile-bg.jpg';

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

// The artwork only owns the first screenful — it scrolls (slower than the
// content) and fades to white, so the Athlete Hub below sits on a clean page.
const HERO_ART_HEIGHT = 640;
// A soft white halo keeps text over the photograph readable.
const HALO = { textShadowColor: 'rgba(255,255,255,0.95)', textShadowRadius: 6 } as const;
const COLLAPSE_START = 90;
const COLLAPSE_END = 190;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Player Profile (public view) — Module 2.2, with Career Stats/Basic Skill
// Rating filled in by Module 2.10 (PRD §12.21/§12.29/§12.32). Skill rating
// comes straight off GET /profile/me (players.skill_rating); the "Career
// Stats" tile links out to the full lifetime/season screen.
//
// Presentation-only redesign ("athlete identity"): every field, link and
// action is unchanged; the many feature links are grouped into a compact
// two-column Athlete Hub instead of one oversized card each.
export default function Profile() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const authUser = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  const bgShift = scrollY.interpolate({
    inputRange: [0, HERO_ART_HEIGHT],
    outputRange: [0, -230],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_END],
    outputRange: [1, 0.15],
    extrapolate: 'clamp',
  });
  const heroScale = scrollY.interpolate({
    inputRange: [0, COLLAPSE_END],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_START, COLLAPSE_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const roleLabel = isPlayer
    ? profile?.playing_role
      ? PLAYING_ROLE_LABELS[profile.playing_role]
      : 'Player'
    : profile?.role === 'TURF_OWNER'
      ? 'Turf Owner'
      : profile?.role === 'TURF_STAFF'
        ? 'Turf Staff'
        : '';

  const idText = profile?.bfam_id ?? '';
  // The name leads the page; the BFAM ID sits beneath it, never in its place.
  const displayName = profile?.full_name?.trim() || 'Player';

  const actionIcons = (
    <View className="flex-row items-center">
      <Pressable
        onPress={() => router.push('/notifications')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        testID="notifications-button"
        className="items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: 'rgba(255,255,255,0.85)',
          marginRight: 10,
        }}
      >
        <Feather name="bell" size={19} color="#0D0D0D" />
      </Pressable>
      <Pressable
        onPress={() => router.push('/profile-settings')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Profile settings"
        testID="profile-settings-button"
        className="items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: 'rgba(255,255,255,0.85)',
        }}
      >
        <Feather name="settings" size={19} color="#0D0D0D" />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Full-bleed campaign artwork behind the whole page (same treatment as
          Home/Matches): floodlit stadium, the BFAM watermark and a batter at
          the top, red brush strokes down the right. It drifts in
          horizontally (no opacity animation, so it can never get stuck
          half-visible) and moves slower than the content on scroll. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HERO_ART_HEIGHT,
          transform: [{ translateY: bgShift }],
        }}
      >
        <MotiView
          from={{ translateX: 14 }}
          animate={{ translateX: 0 }}
          transition={{ type: 'timing', duration: 900 }}
          style={{ width, height: HERO_ART_HEIGHT }}
        >
          <Image
            source={profileBg}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            contentPosition="right top"
            accessibilityElementsHidden
          />
        </MotiView>
        <LinearGradient
          colors={['rgba(255,255,255,0)', '#FFFFFF', '#FFFFFF']}
          locations={[0, 0.78, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 250 }}
        />
      </Animated.View>

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: USE_NATIVE_DRIVER,
          })}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadProfile} tintColor="#D80000" />
          }
          testID="profile-screen"
        >
          <View className="flex-row justify-end items-center" style={{ marginTop: 10 }}>
            {actionIcons}
          </View>

          <Animated.View
            style={{
              // Text/identity on the left, the batter in the artwork on the
              // right — same composition as Teams/Open Teams.
              alignItems: 'flex-start',
              marginTop: 6,
              opacity: heroOpacity,
              transform: [{ scale: heroScale }],
            }}
          >
            {/* A tiny ball drifting back and forth beside the avatar. */}
            <MotiView
              from={{ translateX: -10 }}
              animate={{ translateX: 10 }}
              transition={{ type: 'timing', duration: 3500, loop: true, repeatReverse: true }}
              pointerEvents="none"
              style={{ position: 'absolute', left: 126, top: 70, opacity: 0.45 }}
            >
              <CricketBallIcon size={22} color="#111111" />
            </MotiView>

            <RingFrame size={104}>
              <Avatar uri={profile?.profile_photo_url} size={104} />
              <Pressable
                onPress={() => router.push('/profile-setup?from=profile')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Edit profile photo"
                testID="avatar-edit-button"
                className="items-center justify-center"
                style={{
                  position: 'absolute',
                  right: -6,
                  bottom: -4,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E8E8E8',
                }}
              >
                <Feather name="edit-2" size={14} color="#111111" />
              </Pressable>
            </RingFrame>

            <Reveal delay={200} distance={10}>
              <Text
                className="font-display text-ink-black"
                style={{ fontSize: 40, lineHeight: 46, marginTop: 14, maxWidth: 230, ...HALO }}
                numberOfLines={2}
                testID="profile-full-name"
              >
                {displayName}
              </Text>
            </Reveal>
            {idText ? (
              <Text
                className="font-ui font-bold"
                style={{
                  fontSize: 15,
                  letterSpacing: 1.2,
                  color: '#E10600',
                  marginTop: 2,
                  ...HALO,
                }}
                testID="profile-bfam-id"
              >
                {idText}
              </Text>
            ) : null}
            <Text
              className="font-ui font-medium text-ink-black"
              style={{ fontSize: 14, marginTop: 2, ...HALO }}
            >
              {profile?.phone_number ?? authUser?.user_id ?? ''}
            </Text>
            {roleLabel ? (
              <Reveal delay={320} distance={8}>
                <Text
                  className="font-ui font-bold uppercase"
                  style={{
                    fontSize: 11,
                    letterSpacing: 2.4,
                    color: '#E10600',
                    marginTop: 6,
                    ...HALO,
                  }}
                  testID="profile-role-label"
                >
                  {roleLabel}
                </Text>
              </Reveal>
            ) : null}

            <Reveal delay={420} distance={8}>
              <View style={{ marginTop: 16, alignSelf: 'flex-start' }}>
                <EditProfileButton onPress={() => router.push('/profile-setup?from=profile')} />
              </View>
            </Reveal>

            {profile?.follow_summary ? (
              <View
                className="flex-row items-center"
                style={{
                  marginTop: 20,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.82)',
                }}
                testID="follow-summary"
              >
                <FollowStat value={profile.follow_summary.followers_count} label="Followers" />
                <View style={{ width: 1, height: 38, backgroundColor: '#D8D8D8' }} />
                <FollowStat value={profile.follow_summary.following_count} label="Following" />
              </View>
            ) : null}
          </Animated.View>

          {isPlayer ? (
            <>
              {profile?.favorite_cricketer_name ? (
                <View style={{ marginTop: 26 }}>
                  <FavoriteCricketerCard name={profile.favorite_cricketer_name} />
                </View>
              ) : null}

              <View style={{ marginTop: 28 }}>
                <SectionTitle title="PLAYER DETAILS" />
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
                  <PlayerDetailTile
                    index={0}
                    icon="bat"
                    label="Playing Role"
                    value={profile?.playing_role ? PLAYING_ROLE_LABELS[profile.playing_role] : '—'}
                  />
                  <PlayerDetailTile
                    index={1}
                    icon="helmet"
                    label="Batting Style"
                    value={
                      profile?.batting_style ? BATTING_STYLE_LABELS[profile.batting_style] : '—'
                    }
                  />
                  <PlayerDetailTile
                    index={2}
                    icon="ball"
                    label="Bowling Style"
                    value={profile?.bowling_style ? BOWLING_ARM_LABELS[profile.bowling_style] : '—'}
                  />
                  <PlayerDetailTile
                    index={3}
                    icon="bars"
                    label="Experience"
                    value={
                      profile?.experience_level ? EXPERIENCE_LABELS[profile.experience_level] : '—'
                    }
                  />
                </View>
              </View>

              <View style={{ marginTop: 22 }}>
                <SectionTitle title="ATHLETE HUB" subtitle="Your BFAM journey" />
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
                  <HubCard
                    index={0}
                    icon="bar-chart-2"
                    title="Career Stats"
                    description="Matches, runs, wickets, and more"
                    onPress={() => router.push('/player-statistics')}
                    testID="stats-section"
                  />
                  <HubCard
                    index={1}
                    icon="trending-up"
                    title="Leaderboards"
                    description="Top players, runs, wickets, skill rating"
                    onPress={() => router.push('/leaderboards')}
                    testID="leaderboards-section"
                  />
                  <HubCard
                    index={2}
                    icon="star"
                    title="Level & XP"
                    description="Your progression and XP history"
                    onPress={() => router.push('/xp-level')}
                    testID="xp-level-section"
                  />
                  <HubCard
                    index={3}
                    icon="award"
                    title="Achievements"
                    description="Badges and milestones"
                    onPress={() => router.push('/achievements')}
                    testID="achievements-section"
                  />
                  <HubCard
                    index={4}
                    icon="gift"
                    title="Rewards"
                    description="Spend BFAM Coins on discounts and merch"
                    onPress={() => router.push('/rewards')}
                    testID="rewards-section"
                  />
                  <HubCard
                    index={5}
                    icon="thumbs-up"
                    title="Recognition"
                    description="Player and Sportsman of the Month"
                    onPress={() => router.push('/recognition')}
                    testID="recognition-section"
                  />
                  <HubCard
                    index={6}
                    icon="credit-card"
                    title="Membership"
                    description="Loyalty perks with your BFAM Coins"
                    onPress={() => router.push('/membership')}
                    testID="membership-section"
                  />
                  <HubCard
                    index={7}
                    icon="user-plus"
                    title="Refer a Friend"
                    description="Share your code, earn rewards"
                    onPress={() => router.push('/referrals')}
                    testID="referrals-section"
                  />
                  <HubCard
                    index={8}
                    icon="calendar"
                    title="Match Streaks"
                    description="Weeks in a row you've played — keep it going"
                    onPress={() => router.push('/match-streaks')}
                    testID="match-streaks-section"
                    fullWidth
                  />
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                <SkillRatingCard rating={profile?.skill_rating ?? 500} />
              </View>
            </>
          ) : (
            <Text className="font-ui text-body text-text-secondary text-center mt-6">
              {profile?.role === 'TURF_OWNER'
                ? 'Turf Owner'
                : profile?.role === 'TURF_STAFF'
                  ? 'Turf Staff'
                  : ''}{' '}
              account — BFAM IDs, stats, and ratings are for players only.
            </Text>
          )}

          <LogoutButton onPress={() => clearSession().then(() => router.replace('/login'))} />
        </Animated.ScrollView>

        {/* Compact header that fades in as the hero collapses. */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            opacity: compactOpacity,
          }}
        >
          <SafeAreaView edges={['top']} style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}>
            <View
              className="flex-row items-center justify-between px-5"
              style={{ height: 52, borderBottomWidth: 1, borderBottomColor: '#E8E8E8' }}
              testID="profile-compact-header"
            >
              <View className="flex-row items-baseline">
                <Text className="font-display text-ink-black" style={{ fontSize: 24 }}>
                  {displayName}
                </Text>
                <Text
                  className="font-ui text-text-secondary"
                  style={{ fontSize: 13, marginLeft: 8 }}
                >
                  Profile
                </Text>
              </View>
              <View className="flex-row items-center">
                <Pressable
                  onPress={() => router.push('/notifications')}
                  hitSlop={8}
                  accessibilityLabel="Notifications"
                  style={{ marginRight: 18 }}
                >
                  <Feather name="bell" size={20} color="#0D0D0D" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/profile-settings')}
                  hitSlop={8}
                  accessibilityLabel="Profile settings"
                >
                  <Feather name="settings" size={20} color="#0D0D0D" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// Outlined and quiet on purpose — Log Out must never be the loudest thing on
// the page. The icon only turns red while pressed.
function LogoutButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      animate={{ scale: pressed ? 0.98 : 1 }}
      transition={{ type: 'timing', duration: 150 }}
      style={{ marginTop: 22 }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID="logout-button"
        accessibilityRole="button"
        className="flex-row items-center justify-center"
        style={{
          height: 50,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: pressed ? '#CFCFCF' : '#E0E0E0',
        }}
      >
        <Feather name="log-out" size={17} color={pressed ? '#E10600' : '#444444'} />
        <Text
          className="font-ui font-semibold text-ink-black"
          style={{ fontSize: 15, marginLeft: 10 }}
        >
          Log Out
        </Text>
      </Pressable>
    </MotiView>
  );
}
