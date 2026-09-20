import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Match, MyProfile, PlayerStatistics } from '@bfam/shared-types';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { OwnerDashboard } from '../../src/screens/OwnerDashboard';
import { StaffDashboard } from '../../src/screens/StaffDashboard';
import { apiClient } from '../../src/lib/apiClient';
import { colors } from '../../src/theme/tokens';
import { DISCOVERY_ENABLED } from '../../src/config/featureFlags';
import { HomeBannerCarousel } from '../../src/components/HomeBannerCarousel';

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

function QuickAction({
  icon,
  label,
  onPress,
  loading,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="flex-1 items-center bg-surface rounded-lg border border-border-subtle py-4 mx-1"
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.brandRed} size="small" />
      ) : (
        <Feather name={icon} size={22} color={colors.brandRed} />
      )}
      <Text className="font-ui font-semibold text-micro text-ink-black mt-2 text-center">
        {label}
      </Text>
    </Pressable>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="items-center" style={{ minWidth: 70 }}>
      <Text className="font-display text-title-lg text-brand-red">{value}</Text>
      <Text className="font-ui text-micro text-text-tertiary text-center mt-0.5">{label}</Text>
    </View>
  );
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

  const displayName = profile?.full_name?.split(' ')[0] ?? profile?.bfam_id ?? 'Player';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1 px-5"
        testID="home-screen"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View className="flex-row items-center justify-between pt-4">
          <View>
            <Text className="font-ui text-body text-text-secondary">{greeting()},</Text>
            <Text className="font-ui font-bold text-title-lg text-ink-black">{displayName}</Text>
            {profile?.bfam_id && (
              <Text className="font-ui text-micro text-text-tertiary mt-0.5">
                {profile.bfam_id}
              </Text>
            )}
          </View>
          <View className="flex-row items-center">
            {profile?.coin_balance !== null && profile?.coin_balance !== undefined && (
              <View
                className="flex-row items-center bg-surface-alt rounded-full px-3 py-1.5 mr-3"
                testID="home-coin-balance"
              >
                <MaterialCommunityIcons name="hand-coin" size={16} color={colors.brandRed} />
                <Text className="font-ui font-bold text-body text-ink-black ml-1.5">
                  {profile.coin_balance}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => router.push('/player-search')}
              hitSlop={8}
              accessibilityLabel="Find a player"
              testID="home-search-button"
              className="mr-4"
            >
              <Feather name="search" size={22} color={colors.inkBlack} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={8}
              accessibilityLabel="Notifications"
              testID="home-notifications-button"
              className="mr-4"
            >
              <View>
                <Feather name="bell" size={22} color={colors.inkBlack} />
                {unreadCount > 0 && (
                  <View
                    className="absolute bg-brand-red rounded-full"
                    style={{ width: 8, height: 8, top: -1, right: -1 }}
                  />
                )}
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityLabel="Your profile"
              testID="home-profile-avatar"
            >
              <View
                className="rounded-full bg-brand-red items-center justify-center"
                style={{ width: 36, height: 36 }}
              >
                <Feather name="user" size={18} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Design §5's signature diagonal-red hero motif, consistent with
            the auth screens' background treatment. */}
        <View className="bg-ink-black rounded-lg mt-5 p-6 overflow-hidden">
          <Text className="font-display text-title-xl text-white">READY TO PLAY?</Text>
          <Text className="font-ui text-body text-white/70 mt-2 mb-5" style={{ maxWidth: 240 }}>
            Find your turf. Build your team. Own the moment.
          </Text>
          <Button
            label="Find a Match"
            variant="secondary"
            iconRight={<Feather name="arrow-right" size={16} color="#0D0D0D" />}
            onPress={() => router.push('/(tabs)/matches')}
            testID="home-find-match-button"
          />
        </View>

        <View className="flex-row mt-6" style={{ marginHorizontal: -4 }}>
          <QuickAction
            icon="calendar"
            label="Book Turf"
            onPress={bookTurf}
            loading={bookTurfBusy}
            testID="home-book-turf-quick-action"
          />
          <QuickAction
            icon="users"
            label="Create Team"
            onPress={() => router.push('/(tabs)/teams/create')}
            testID="home-create-team-quick-action"
          />
          <QuickAction
            icon="user-plus"
            label="Find Teams"
            onPress={() => router.push('/(tabs)/teams/open')}
            testID="home-find-teams-quick-action"
          />
          <QuickAction
            icon="list"
            label="My Matches"
            onPress={() => router.push('/(tabs)/matches')}
            testID="home-my-matches-quick-action"
          />
        </View>
        {bookTurfError && (
          <Text className="font-ui text-body text-brand-red-dark mt-3">{bookTurfError}</Text>
        )}

        {loading ? (
          <ActivityIndicator
            color={colors.brandRed}
            style={{ marginTop: 32 }}
            testID="home-loading"
          />
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
                <Text className="font-ui text-micro font-bold text-text-tertiary">NEXT MATCH</Text>
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
              <View
                className="bg-surface rounded-lg border border-border-subtle mt-6 p-5"
                testID="home-performance-card"
              >
                <Text className="font-ui text-micro font-bold text-text-tertiary mb-3">
                  YOUR PERFORMANCE
                </Text>
                <View className="flex-row justify-between">
                  <StatTile value={stats.matches_played} label="Matches" />
                  <StatTile value={stats.runs} label="Runs" />
                  <StatTile value={stats.wickets} label="Wickets" />
                  <StatTile value={stats.current_streak ?? 0} label="Streak" />
                </View>
              </View>
            )}
          </>
        )}

        <View className="mt-6 mb-8">
          <HomeBannerCarousel />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
