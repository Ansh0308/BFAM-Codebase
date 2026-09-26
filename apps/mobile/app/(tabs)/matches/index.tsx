import React, { useCallback, useRef, useState } from 'react';
import { Animated, Platform, Text, View, useWindowDimensions } from 'react-native';
import { BallLoader } from '../../../src/components/BallLoader';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import type { MyMatch } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { Button } from '../../../src/components/Button';
import { Reveal } from '../../../src/components/Reveal';
import { SegmentedTabs } from '../../../src/components/SegmentedTabs';
import { PlayerHeader } from '../../../src/components/home/PlayerHeader';
import {
  FindRoomPanel,
  MatchCard,
  type LiveScoreSummary,
} from '../../../src/components/matches/MatchesParts';
import matchesBg from '../../../src/assets/images/matches-bg.jpg';

type MatchScope = 'upcoming' | 'past';

const HERO_SCROLL_RANGE = 160;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// My Matches (module 2.6 — Matches tab). Every match the caller organizes,
// scores, or is on the roster for. Presentation only was redesigned here —
// the data, the Upcoming/Past split (A-15), Find a Room (B-11) and every
// navigation target are unchanged; the venue line and a live score on live
// matches are the two additions the design calls for.
export default function MyMatchesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [scope, setScope] = useState<MatchScope>('upcoming');
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveScores, setLiveScores] = useState<Record<string, LiveScoreSummary>>({});
  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback((forScope: MatchScope) => {
    setLoading(true);
    apiClient
      .getMyMatches(forScope)
      .then((res) => {
        setMatches(res.results);
        res.results
          .filter((m) => m.match_status === 'IN_PROGRESS')
          .forEach((m) => {
            apiClient
              .getLiveScore(m.match_id)
              .then((score) => {
                if (!score.innings) return;
                const summary: LiveScoreSummary = {
                  runs: score.innings.total_runs,
                  wickets: score.innings.total_wickets,
                  overs: Number(score.innings.overs_completed),
                };
                setLiveScores((prev) => ({ ...prev, [m.match_id]: summary }));
              })
              .catch(() => {});
          });
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope);
    }, [load, scope]),
  );

  // Header data (BFAM Points + unread dot) — best effort, and independent of
  // the Upcoming/Past scope, so it only refreshes when the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      apiClient
        .getMyProfile()
        .then((p) => setPoints(p.coin_balance))
        .catch(() => {});
      apiClient
        .getNotifications()
        .then((n) => setUnreadCount(n.results.filter((x) => !x.read_at).length))
        .catch(() => {});
    }, []),
  );

  const heroScale = scrollY.interpolate({
    inputRange: [0, HERO_SCROLL_RANGE],
    outputRange: [1, 0.88],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HERO_SCROLL_RANGE],
    outputRange: [1, 0.55],
    extrapolate: 'clamp',
  });
  const bgShift = scrollY.interpolate({
    inputRange: [0, 400],
    outputRange: [0, -70],
    extrapolate: 'clamp',
  });

  const header = (
    <View testID="my-matches-header">
      <PlayerHeader points={points} unreadCount={unreadCount} />

      <Animated.View
        style={{
          marginTop: 34,
          marginBottom: 26,
          transformOrigin: 'left center',
          transform: [{ scale: heroScale }],
          opacity: heroOpacity,
        }}
      >
        <Reveal delay={60}>
          <Text
            className="font-display text-ink-black"
            style={{ fontSize: 54, lineHeight: 58, letterSpacing: 0.5 }}
            testID="my-matches-title"
          >
            MATCHES
          </Text>
        </Reveal>
        <Reveal delay={180}>
          <Text
            className="font-ui text-text-secondary"
            style={{ fontSize: 11, letterSpacing: 2, marginTop: 6 }}
          >
            YOUR GAMES, YOUR JOURNEY
          </Text>
        </Reveal>
        <MotiView
          from={{ width: 0 }}
          animate={{ width: 56 }}
          transition={{ type: 'timing', duration: 450, delay: 320 }}
          className="bg-brand-red"
          style={{ height: 4, borderRadius: 2, marginTop: 14 }}
        />
      </Animated.View>

      <FindRoomPanel onPress={() => router.push('/(tabs)/matches/rooms')} />

      <View style={{ marginTop: 26 }}>
        {/* Backlog A-15: split into Upcoming/Past instead of one long,
            undifferentiated list of every match ever played. */}
        <SegmentedTabs
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          value={scope}
          onChange={setScope}
          testIDPrefix="my-matches-scope"
        />
      </View>

      <View className="flex-row items-end justify-between" style={{ marginBottom: 16 }}>
        <Text
          className="font-ui font-bold text-ink-black"
          style={{ fontSize: 15, letterSpacing: 2 }}
        >
          YOUR MATCHES
        </Text>
        {!loading && (
          <Text className="font-ui text-text-secondary" style={{ fontSize: 13 }}>
            {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
          </Text>
        )}
      </View>
    </View>
  );

  const empty = loading ? (
    <BallLoader testID="my-matches-loading" style={{ marginTop: 24 }} />
  ) : (
    <View className="items-center" style={{ marginTop: 20, paddingHorizontal: 12 }}>
      <View
        className="items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#FDECEC',
          marginBottom: 16,
        }}
      >
        <MaterialCommunityIcons name="cricket" size={28} color={colors.brandRed} />
      </View>
      <Text className="font-display text-ink-black" style={{ fontSize: 26, marginBottom: 6 }}>
        NO MATCHES YET
      </Text>
      <Text className="font-ui text-body text-text-secondary text-center mb-6">
        {scope === 'upcoming'
          ? 'Your next game starts here. Book a turf, then create a match for it.'
          : 'No past matches yet.'}
      </Text>
      {scope === 'upcoming' && (
        <Button
          label="Book a Turf"
          variant="secondary"
          onPress={() => router.push('/(tabs)/discover')}
          testID="my-matches-empty-book-turf"
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="my-matches-screen">
      {/* Full-bleed campaign artwork behind the whole screen — a faint BFAM
          watermark and batter at the top, red brush marks low right. It
          drifts in horizontally (no opacity animation, so it can never get
          stuck half-visible) and moves slower than the list on scroll. */}
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
            source={matchesBg}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            contentPosition="right top"
            accessibilityElementsHidden
          />
        </MotiView>
      </Animated.View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <Animated.FlatList
          data={loading ? [] : matches}
          keyExtractor={(item) => (item as MyMatch).match_id}
          renderItem={({ item, index }) => {
            const match = item as MyMatch;
            return (
              <MatchCard
                match={match}
                index={index}
                live={liveScores[match.match_id] ?? null}
                onPress={() => router.push(`/(tabs)/matches/${match.match_id}`)}
                onWatchLive={() => router.push(`/(tabs)/matches/${match.match_id}/live`)}
              />
            );
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: USE_NATIVE_DRIVER,
          })}
        />
      </SafeAreaView>
    </View>
  );
}
