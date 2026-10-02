import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';
import { BallLoader } from '../../../src/components/BallLoader';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import type { MyTeam, OpenTeam } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { Reveal } from '../../../src/components/Reveal';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SegmentedTabs } from '../../../src/components/SegmentedTabs';
import { colors } from '../../../src/theme/tokens';
import {
  CityFilterField,
  EmptyOpenTeams,
  OpenTeamCard,
} from '../../../src/components/teams/OpenTeamsParts';
import teamsBg from '../../../src/assets/images/teams-bg.jpg';

type DiscoveryMode = 'players' | 'challenge';

const HERO_HEIGHT = 260;

// Open Teams: vacancy discovery + Join Team Request (PRD §12.4), plus
// (backlog B-13) a second mode for teams open to a Team vs Team challenge
// — folded into this same screen per the founder's own suggested option,
// rather than a wholly separate screen. Presentation-only redesign: the
// data, both modes, the city filter, the Fair Play / min-skill-rating
// callouts, and every request/challenge action are unchanged.
export default function OpenTeamsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<DiscoveryMode>('players');
  const [city, setCity] = useState('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [teams, setTeams] = useState<OpenTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [myCaptainedTeams, setMyCaptainedTeams] = useState<MyTeam[]>([]);
  const [challengingTeamId, setChallengingTeamId] = useState<string | null>(null);
  const [challengeSentIds, setChallengeSentIds] = useState<Set<string>>(new Set());
  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (discoveryMode: DiscoveryMode, cityFilter: string) => {
    setLoading(true);
    try {
      const [teamsRes, myTeamsRes] = await Promise.all([
        apiClient.getOpenTeams({
          mode: discoveryMode,
          ...(cityFilter ? { city: cityFilter } : {}),
        }),
        apiClient.getMyTeams(),
      ]);
      setTeams(teamsRes.results);
      setMyCaptainedTeams(myTeamsRes.results.filter((t) => t.role_in_team === 'CAPTAIN'));
    } catch {
      setError(
        discoveryMode === 'challenge'
          ? 'Could not load challengeable teams.'
          : 'Could not load open teams.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on every focus, not just first mount — a team's open-for-
  // players/open-for-challenge/skill-level/city may have changed (or
  // requestedIds should reset for a freshly-relevant list) since this tab
  // was last visited, same reasoning as Discover's turf listing (module 2.3).
  useFocusEffect(
    useCallback(() => {
      load(mode, city);
    }, [load, mode, city]),
  );

  // The city picker's options come from the full (unfiltered-by-city)
  // result set for the current mode, not a fixed/hardcoded city list —
  // refetched only when the mode changes, so picking a city doesn't shrink
  // its own option list.
  useEffect(() => {
    apiClient
      .getOpenTeams({ mode })
      .then((res) => {
        const cities = Array.from(
          new Set(res.results.map((t) => t.home_city).filter((c): c is string => Boolean(c))),
        ).sort((a, b) => a.localeCompare(b));
        setCityOptions(cities);
      })
      .catch(() => {});
  }, [mode]);

  async function requestToJoin(teamId: string) {
    setError(null);
    try {
      await apiClient.requestToJoinTeam(teamId);
      setRequestedIds((prev) => new Set(prev).add(teamId));
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not send a join request.');
    }
  }

  async function challengeTeam(challengedTeamId: string, myTeamId: string) {
    setError(null);
    setChallengingTeamId(myTeamId);
    try {
      await apiClient.sendChallenge(myTeamId, challengedTeamId);
      setChallengeSentIds((prev) => new Set(prev).add(challengedTeamId));
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not send the challenge.');
    } finally {
      setChallengingTeamId(null);
    }
  }

  const header = (
    <View testID="open-teams-header">
      <View style={{ height: HERO_HEIGHT, overflow: 'hidden' }} testID="open-teams-hero">
        <MotiView
          from={{ translateX: 14 }}
          animate={{ translateX: 0 }}
          transition={{ type: 'timing', duration: 900 }}
          style={{ position: 'absolute', top: 0, right: 0, width, height: HERO_HEIGHT }}
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
          locations={[0, 0.82, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 190 }}
        />

        <View style={{ paddingTop: 2 }}>
          <Reveal delay={60}>
            <Text
              className="font-display text-ink-black"
              style={{ fontSize: 46, lineHeight: 48 }}
              testID="open-teams-title"
            >
              OPEN
            </Text>
            <Text className="font-display text-brand-red" style={{ fontSize: 46, lineHeight: 48 }}>
              TEAMS
            </Text>
          </Reveal>
          <Reveal delay={180}>
            <Text
              className="font-ui text-text-secondary"
              style={{ fontSize: 11, lineHeight: 17, letterSpacing: 2.4, marginTop: 8 }}
            >
              {'FIND YOUR SQUAD.\nPLAY TOGETHER.'}
            </Text>
          </Reveal>
          <MotiView
            from={{ width: 0 }}
            animate={{ width: 44 }}
            transition={{ type: 'timing', duration: 450, delay: 320 }}
            style={{ height: 3, borderRadius: 2, backgroundColor: colors.brandRed, marginTop: 12 }}
          />
        </View>
      </View>

      <SegmentedTabs
        options={[
          { value: 'players', label: 'Open for Players' },
          { value: 'challenge', label: 'Open for Challenge' },
        ]}
        value={mode}
        onChange={(m) => setMode(m as DiscoveryMode)}
        testIDPrefix="open-teams-mode"
      />

      <CityFilterField value={city} options={cityOptions} onChange={setCity} />

      {error && (
        <Text className="text-brand-red text-body mb-3" testID="open-teams-error">
          {error}
        </Text>
      )}

      {!loading && teams.length > 0 && (
        <View className="flex-row items-center justify-between" style={{ marginBottom: 14 }}>
          <Text
            className="font-ui font-bold text-ink-black"
            style={{ fontSize: 13, letterSpacing: 1.6 }}
          >
            {teams.length} {teams.length === 1 ? 'TEAM' : 'TEAMS'} AVAILABLE
          </Text>
        </View>
      )}
    </View>
  );

  const empty = loading ? (
    <BallLoader testID="open-teams-loading" style={{ marginTop: 24 }} />
  ) : (
    <EmptyOpenTeams mode={mode} onCreateTeam={() => router.push('/(tabs)/teams/create')} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="open-teams-screen">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="px-5">
          <ScreenHeader title="Open Teams" />
        </View>

        <Animated.FlatList
          data={loading ? [] : teams}
          keyExtractor={(item) => (item as OpenTeam).team_id}
          renderItem={({ item, index }) => {
            const team = item as OpenTeam;
            return (
              <OpenTeamCard
                team={team}
                index={index}
                mode={mode}
                requested={requestedIds.has(team.team_id)}
                onRequestToJoin={() => requestToJoin(team.team_id)}
                myCaptainedTeams={myCaptainedTeams}
                challengeSentIds={challengeSentIds}
                challengingTeamId={challengingTeamId}
                onChallenge={(myTeamId) => challengeTeam(team.team_id, myTeamId)}
                onPress={() => router.push(`/(tabs)/teams/${team.team_id}`)}
              />
            );
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
        />
      </SafeAreaView>
    </View>
  );
}
