import React, { useCallback, useRef, useState } from 'react';
import { Animated, Platform, Text, View, useWindowDimensions } from 'react-native';
import { BallLoader } from '../../../src/components/BallLoader';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import type { MyTeam } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { Reveal } from '../../../src/components/Reveal';
import { PlayerHeader } from '../../../src/components/home/PlayerHeader';
import {
  CreateTeamButton,
  EmptyTeams,
  FindOpenTeamsButton,
  TeamCard,
} from '../../../src/components/teams/TeamsParts';
import teamsBg from '../../../src/assets/images/teams-bg.jpg';

const HERO_SCROLL_RANGE = 160;
// The art is sized to the screen width and nudged up so the huddle sits just
// under the header, to the right of the headline, with the CTAs starting
// around the players' waists. It fades into white below.
const ART_ASPECT = 941 / 1672;
const ART_OFFSET = 44;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// My Teams (PRD §12.3). Presentation-only redesign: the same list, Create
// Team, Find Open Teams, copy-a-team (A-11) and open-a-team navigation; the
// header data and per-team member / match / win-loss counts are the additions
// the design calls for.
export default function MyTeamsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const artHeight = width / ART_ASPECT;
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMyTeams()
      .then((res) => setTeams(res.results))
      // A TURF_OWNER/TURF_STAFF account has no player profile — getMyTeams
      // 400s for them (see PlayerProfileNotFoundError). Same "just show the
      // empty state" fallback as the sibling Matches tab rather than
      // crashing with an uncaught rejection.
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Header data (BFAM Points + unread dot) — best effort.
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
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HERO_SCROLL_RANGE],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });
  const bgShift = scrollY.interpolate({
    inputRange: [0, 400],
    outputRange: [0, -40],
    extrapolate: 'clamp',
  });

  const header = (
    <View testID="my-teams-header">
      <PlayerHeader points={points} unreadCount={unreadCount} />

      <Animated.View
        style={{
          marginTop: 44,
          marginBottom: 24,
          transformOrigin: 'left center',
          transform: [{ scale: heroScale }],
          opacity: heroOpacity,
        }}
      >
        <Reveal delay={60}>
          <Text
            className="font-display text-ink-black"
            style={{ fontSize: 46, lineHeight: 50, letterSpacing: 0.5 }}
            testID="my-teams-title"
          >
            MY TEAMS
          </Text>
        </Reveal>
        <Reveal delay={180}>
          <Text
            className="font-ui text-text-secondary"
            style={{ fontSize: 11, lineHeight: 17, letterSpacing: 3, marginTop: 8 }}
          >
            {'PLAY TOGETHER.\nGROW TOGETHER.'}
          </Text>
        </Reveal>
        <MotiView
          from={{ width: 0 }}
          animate={{ width: 56 }}
          transition={{ type: 'timing', duration: 450, delay: 320 }}
          style={{ height: 4, borderRadius: 2, marginTop: 14, backgroundColor: '#E10600' }}
        />
      </Animated.View>

      <CreateTeamButton
        onPress={() => router.push('/(tabs)/teams/create')}
        testID="create-team-button"
      />
      <View style={{ height: 12 }} />
      <FindOpenTeamsButton
        onPress={() => router.push('/(tabs)/teams/open')}
        testID="find-open-teams-button"
      />

      {!loading && teams.length > 0 && (
        <View
          className="flex-row items-end justify-between"
          style={{ marginTop: 32, marginBottom: 14 }}
        >
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 15, letterSpacing: 2 }}
          >
            YOUR TEAMS
          </Text>
          <Text className="font-ui text-text-secondary" style={{ fontSize: 13 }}>
            {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
          </Text>
        </View>
      )}
    </View>
  );

  const empty = loading ? (
    <BallLoader testID="my-teams-loading" style={{ marginTop: 24 }} />
  ) : (
    <View style={{ marginTop: 32 }}>
      <EmptyTeams onCreate={() => router.push('/(tabs)/teams/create')} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="my-teams-screen">
      {/* Full-bleed campaign artwork behind the whole screen — the BFAM huddle
          at the top right, red brush marks low right. It drifts in
          horizontally (no opacity animation, so it can never get stuck
          half-visible) and moves slower than the list on scroll. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -ART_OFFSET,
          left: 0,
          right: 0,
          height: artHeight,
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
            source={teamsBg}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            contentPosition="right top"
            accessibilityElementsHidden
          />
        </MotiView>
        <LinearGradient
          colors={['rgba(255,255,255,0)', '#FFFFFF', '#FFFFFF']}
          locations={[0, 0.8, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 260 }}
        />
      </Animated.View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <Animated.FlatList
          data={loading ? [] : teams}
          keyExtractor={(item) => (item as MyTeam).team_id}
          renderItem={({ item, index }) => {
            const team = item as MyTeam;
            return (
              <TeamCard
                team={team}
                index={index}
                onPress={() => router.push(`/(tabs)/teams/${team.team_id}`)}
                onCopy={() =>
                  router.push({
                    pathname: '/(tabs)/teams/create',
                    params: {
                      copyFromTeamName: team.team_name,
                      copyFromDescription: team.description ?? '',
                      copyFromHomeCity: team.home_city ?? '',
                      copyFromSkillLevel: team.skill_level ?? '',
                      copyFromIsOpen: String(team.is_open_for_players),
                    },
                  })
                }
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
