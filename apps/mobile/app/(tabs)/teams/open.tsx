import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../src/components/BallLoader';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { MyTeam, OpenTeam } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { TextField } from '../../../src/components/TextField';

type DiscoveryMode = 'players' | 'challenge';

// Open Teams: vacancy discovery + Join Team Request (PRD §12.4), plus
// (backlog B-13) a second mode for teams open to a Team vs Team challenge
// — folded into this same screen per the founder's own suggested option,
// rather than a wholly separate screen. Filter by skill level and city
// only — map view is explicitly out of scope, same as Turf Discovery
// (module 2.3).
export default function OpenTeamsScreen() {
  const [mode, setMode] = useState<DiscoveryMode>('players');
  const [city, setCity] = useState('');
  const [teams, setTeams] = useState<OpenTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [myCaptainedTeams, setMyCaptainedTeams] = useState<MyTeam[]>([]);
  const [challengingTeamId, setChallengingTeamId] = useState<string | null>(null);
  const [challengeSentIds, setChallengeSentIds] = useState<Set<string>>(new Set());

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

  return (
    <ScreenContainer>
      <View className="pt-6 flex-1" testID="open-teams-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Open Teams</Text>

        <View className="flex-row bg-surface-alt rounded-md p-1 mb-4">
          {(['players', 'challenge'] as DiscoveryMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              className={`flex-1 items-center py-2 rounded-md ${mode === m ? 'bg-brand-red' : ''}`}
              testID={`open-teams-mode-${m}`}
            >
              <Text
                className={`font-ui font-bold text-micro uppercase ${
                  mode === m ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {m === 'players' ? 'Open for Players' : 'Open for Challenge'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextField
          label="City"
          value={city}
          onChangeText={setCity}
          onSubmitEditing={() => load(mode, city)}
          placeholder="Filter by city"
          iconLeft={<Feather name="map-pin" size={16} color="#767676" />}
          testID="open-teams-city-filter"
          returnKeyType="search"
        />

        {error && <Text className="text-brand-red text-body mb-3">{error}</Text>}

        {loading ? (
          <BallLoader testID="open-teams-loading" />
        ) : teams.length === 0 ? (
          <Text className="font-ui text-body text-text-secondary text-center mt-4">
            {mode === 'challenge' ? 'No teams open for a challenge yet.' : 'No open teams found.'}
          </Text>
        ) : (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.team_id}
            renderItem={({ item }) => {
              const requested = requestedIds.has(item.team_id);
              return (
                <View
                  className="bg-surface rounded-lg border border-border-subtle p-4 mb-3"
                  testID={`open-team-row-${item.team_id}`}
                >
                  <View className="flex-row items-center">
                    <View
                      className="rounded-full bg-surface-alt items-center justify-center mr-3"
                      style={{ width: 44, height: 44 }}
                    >
                      <Feather name="users" size={18} color="#D80000" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text
                          className="font-ui font-semibold text-card-title text-ink-black flex-shrink"
                          numberOfLines={1}
                        >
                          {item.team_name}
                        </Text>
                        {/* Backlog B-5: Fair Play score — how evenly this
                            team has shared batting/bowling chances across
                            its roster, averaged from active members'
                            reliability_score. Hidden until the team has
                            an active member with a computed score. */}
                        {item.fair_play_score != null && (
                          <View
                            className="ml-2 rounded-md bg-status-info-bg px-2.5 py-1 flex-row items-center"
                            testID={`fair-play-score-${item.team_id}`}
                          >
                            <Feather name="shield" size={10} color="#1D5DAD" />
                            <Text className="font-ui text-micro font-bold text-status-info ml-1">
                              {item.fair_play_score}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-text-secondary text-micro mt-0.5">
                        {item.home_city ?? 'City not set'} · {item.skill_level ?? 'Any level'} ·{' '}
                        {item.active_member_count} members
                      </Text>
                      {/* Backlog B-8: shown so a player knows the
                          requirement before requesting, rather than only
                          finding out from a rejected request. */}
                      {item.min_skill_rating != null && (
                        <Text
                          className="text-text-tertiary text-micro mt-0.5"
                          testID={`min-skill-rating-${item.team_id}`}
                        >
                          Requires {item.min_skill_rating}+ Skill Rating
                        </Text>
                      )}
                    </View>
                  </View>
                  {mode === 'players' ? (
                    <Pressable
                      onPress={() => requestToJoin(item.team_id)}
                      disabled={requested}
                      className={`mt-3 rounded-md py-3 items-center ${
                        requested ? 'bg-disabled-surface' : 'bg-brand-red'
                      }`}
                      testID={`request-to-join-${item.team_id}`}
                    >
                      <Text
                        className={`font-ui font-bold text-button uppercase tracking-wide ${
                          requested ? 'text-text-tertiary' : 'text-white'
                        }`}
                      >
                        {requested ? 'Requested' : 'Request to Join'}
                      </Text>
                    </Pressable>
                  ) : myCaptainedTeams.filter((t) => t.team_id !== item.team_id).length === 0 ? (
                    <Text className="text-text-tertiary text-micro mt-3">
                      You need to captain a team to send a challenge.
                    </Text>
                  ) : (
                    myCaptainedTeams
                      .filter((t) => t.team_id !== item.team_id)
                      .map((myTeam) => {
                        const sent = challengeSentIds.has(item.team_id);
                        return (
                          <Pressable
                            key={myTeam.team_id}
                            onPress={() => challengeTeam(item.team_id, myTeam.team_id)}
                            disabled={sent || challengingTeamId === myTeam.team_id}
                            className={`mt-3 rounded-md py-3 items-center ${
                              sent ? 'bg-disabled-surface' : 'bg-brand-red'
                            }`}
                            testID={`challenge-open-team-${item.team_id}-${myTeam.team_id}`}
                          >
                            <Text
                              className={`font-ui font-bold text-button uppercase tracking-wide ${
                                sent ? 'text-text-tertiary' : 'text-white'
                              }`}
                            >
                              {sent ? 'Challenge Sent' : `Challenge with ${myTeam.team_name}`}
                            </Text>
                          </Pressable>
                        );
                      })
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
