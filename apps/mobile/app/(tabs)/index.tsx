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
import { BallLoader } from '../../src/components/BallLoader';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Match, MyProfile, PlayerStatistics } from '@bfam/shared-types';
import { useAuthStore } from '../../src/store/authStore';
import { OwnerDashboard } from '../../src/screens/OwnerDashboard';
import { StaffDashboard } from '../../src/screens/StaffDashboard';
import { apiClient } from '../../src/lib/apiClient';
import { DISCOVERY_ENABLED } from '../../src/config/featureFlags';
import { HomeBannerCarousel } from '../../src/components/HomeBannerCarousel';
import { HomeHero } from '../../src/components/home/HomeHero';
import { PerformanceCard, QuickAction } from '../../src/components/home/HomeParts';
import { PlayerHeader } from '../../src/components/home/PlayerHeader';
import homeBg from '../../src/assets/images/home-hero.jpg';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatMatchWhen(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

interface LiveSummary {
  match: Match;
  totalRuns: number;
  totalWickets: number;
  oversCompleted: number;
}

// Home tab — role router (module 2.12, PRD §8.3/§8.4). TURF_OWNER/
// TURF_STAFF land on their real Owner/Staff Dashboard; the PLAYER
// experience below is Backlog B-7's Home redesign (top-of-app hub: quick
// actions, next/live match, performance snapshot, offers carousel) — every
// number on it is read from a real endpoint, nothing fabricated (no
// level/XP system exists in this codebase, so that's deliberately not
// shown, unlike the reference mockup).
export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [live, setLive] = useState<LiveSummary | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookTurfBusy, setBookTurfBusy] = useState(false);
  const [bookTurfError, setBookTurfError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [profileRes, statsRes, matchesRes, notificationsRes] = await Promise.all([
        apiClient.getMyProfile(),
        apiClient.getPlayerStatistics('me').catch(() => null),
        apiClient.getMyMatches().catch(() => ({ results: [] as Match[] })),
        apiClient.getNotifications().catch(() => ({ results: [] })),
      ]);
      setProfile(profileRes);
      setStats(statsRes);
      setUnreadCount(notificationsRes.results.filter((n) => !n.read_at).length);

      const now = Date.now();
      const upcoming = matchesRes.results
        .filter((m) => ['OPEN', 'PENDING', 'CONFIRMED'].includes(m.match_status))
        .filter((m) => new Date(m.scheduled_start_time).getTime() >= now)
        .sort(
          (a, b) =>
            new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime(),
        );
      setNextMatch(upcoming[0] ?? null);

      const liveMatch = matchesRes.results.find((m) => m.match_status === 'IN_PROGRESS');
      if (liveMatch) {
        const score = await apiClient.getLiveScore(liveMatch.match_id).catch(() => null);
        setLive(
          score?.innings
            ? {
                match: liveMatch,
                totalRuns: score.innings.total_runs,
                totalWickets: score.innings.total_wickets,
                oversCompleted: score.innings.overs_completed,
              }
            : null,
        );
      } else {
        setLive(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (role !== 'PLAYER') return;
      load();
    }, [load, role]),
  );

  if (role === 'TURF_OWNER') return <OwnerDashboard />;
  if (role === 'TURF_STAFF') return <StaffDashboard />;

  // Backlog A-12: Discover is temporarily hidden (see featureFlags.ts) —
  // with only one turf to offer for now, skip the listing entirely and go
  // straight to that turf's availability screen (per the backlog's own
  // resolution of "what replaces Discover meanwhile").
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

  const bgShift = scrollY.interpolate({
    inputRange: [0, 400],
    outputRange: [0, -70],
    extrapolate: 'clamp',
  });

  const displayName = profile?.full_name?.split(' ')[0] ?? profile?.bfam_id ?? 'Player';

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Full-bleed campaign artwork behind the whole screen (same treatment
          as Matches): the batter sits mid-screen behind the hero, red brush
          marks at the top right. It drifts in horizontally (no opacity
          animation, so it can't get stuck half-visible) and moves slower
          than the content on scroll. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateY: bgShift }],
        }}
      >
        <MotiView
          from={{ translateX: 14 }}
          animate={{ translateX: 0 }}
          transition={{ type: 'timing', duration: 900 }}
          style={{ width, height: '100%' }}
        >
          <Image
            source={homeBg}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            contentPosition="right top"
            accessibilityElementsHidden
          />
        </MotiView>
      </Animated.View>

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <Animated.ScrollView
          className="flex-1 px-5"
          testID="home-screen"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: Platform.OS !== 'web',
          })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          <PlayerHeader points={profile?.coin_balance} unreadCount={unreadCount} />

          <View style={{ marginTop: 18 }}>
            <Text className="font-ui text-text-secondary" style={{ fontSize: 16 }}>
              {greeting()},
            </Text>
            <Text
              className="font-ui font-bold text-ink-black"
              style={{ fontSize: 26, lineHeight: 32 }}
            >
              {displayName}
            </Text>
            {profile?.bfam_id && (
              <Text className="font-ui text-text-tertiary" style={{ fontSize: 12, marginTop: 1 }}>
                {profile.bfam_id}
              </Text>
            )}
          </View>

          <HomeHero onFindMatch={() => router.push('/(tabs)/matches')} />

          <View className="flex-row mt-5" style={{ marginHorizontal: -4 }}>
            <QuickAction
              icon="calendar"
              label="Book Turf"
              caption="PLAY NOW"
              onPress={bookTurf}
              loading={bookTurfBusy}
              testID="home-book-turf-quick-action"
            />
            <QuickAction
              icon="users"
              label="Create Team"
              caption="BUILD SQUAD"
              onPress={() => router.push('/(tabs)/teams/create')}
              testID="home-create-team-quick-action"
            />
            <QuickAction
              icon="user-plus"
              label="Find Teams"
              caption="JOIN PLAYERS"
              onPress={() => router.push('/(tabs)/teams/open')}
              testID="home-find-teams-quick-action"
            />
            <QuickAction
              icon="list"
              label="My Matches"
              caption="YOUR GAMES"
              onPress={() => router.push('/(tabs)/matches')}
              testID="home-my-matches-quick-action"
            />
          </View>
          {bookTurfError && (
            <Text className="font-ui text-body text-brand-red-dark mt-3">{bookTurfError}</Text>
          )}

          {loading ? (
            <BallLoader size="inline" testID="home-loading" style={{ marginTop: 32 }} />
          ) : (
            <>
              {live && (
                <Pressable
                  onPress={() => router.push(`/(tabs)/matches/${live.match.match_id}/live`)}
                  className="bg-ink-black rounded-lg mt-6 p-5"
                  testID="home-live-match-card"
                >
                  <View className="flex-row items-center mb-2">
                    <View className="bg-brand-red rounded-sm px-2 py-0.5 mr-2">
                      <Text className="font-ui font-bold text-micro text-white">LIVE</Text>
                    </View>
                    <Text className="font-ui text-body text-white flex-1" numberOfLines={1}>
                      {live.match.match_name ?? 'Live Match'}
                    </Text>
                  </View>
                  <View className="flex-row items-end justify-between">
                    <Text className="font-display text-title-xl text-white">
                      {live.totalRuns}/{live.totalWickets}
                    </Text>
                    <Text className="font-ui text-body text-white/70">
                      {live.oversCompleted.toFixed(1)} overs
                    </Text>
                  </View>
                  <Text className="font-ui font-bold text-micro text-brand-red-light mt-2">
                    WATCH LIVE →
                  </Text>
                </Pressable>
              )}

              {nextMatch && (
                <Pressable
                  onPress={() => router.push(`/(tabs)/matches/${nextMatch.match_id}`)}
                  className="bg-surface rounded-lg border border-border-subtle mt-6 p-5"
                  testID="home-next-match-card"
                >
                  <Text className="font-ui text-micro font-bold text-text-tertiary">
                    NEXT MATCH
                  </Text>
                  <Text
                    className="font-ui font-bold text-card-title text-ink-black mt-1"
                    numberOfLines={1}
                  >
                    {nextMatch.match_name ?? 'Upcoming Match'}
                  </Text>
                  <Text className="font-ui text-body text-text-secondary mt-1">
                    {formatMatchWhen(nextMatch.scheduled_start_time)}
                  </Text>
                </Pressable>
              )}

              {stats && (
                <PerformanceCard
                  matches={stats.matches_played}
                  runs={stats.runs}
                  wickets={stats.wickets}
                  streak={stats.current_streak ?? 0}
                  onViewDetails={() => router.push('/player-statistics')}
                />
              )}
            </>
          )}

          <View className="mt-6 mb-8">
            <HomeBannerCarousel />
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}
