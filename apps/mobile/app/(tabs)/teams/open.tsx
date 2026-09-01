import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { OpenTeam } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { TextField } from '../../../src/components/TextField';

// Open Teams: vacancy discovery + Join Team Request (PRD §12.4). Filter by
// skill level and city only — map view is explicitly out of scope, same as
// Turf Discovery (module 2.3).
export default function OpenTeamsScreen() {
  const [city, setCity] = useState('');
  const [teams, setTeams] = useState<OpenTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cityFilter: string) => {
    setLoading(true);
    try {
      const res = await apiClient.getOpenTeams(cityFilter ? { city: cityFilter } : {});
      setTeams(res.results);
    } catch {
      setError('Could not load open teams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

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

  return (
    <ScreenContainer>
      <View className="pt-6 flex-1" testID="open-teams-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">Open Teams</Text>

        <TextField
          label="City"
          value={city}
          onChangeText={setCity}
          onSubmitEditing={() => load(city)}
          placeholder="Filter by city"
          iconLeft={<Feather name="map-pin" size={16} color="#767676" />}
          testID="open-teams-city-filter"
          returnKeyType="search"
        />

        {error && <Text className="text-brand-red text-body mb-3">{error}</Text>}

        {loading ? (
          <ActivityIndicator size="large" color={colors.brandRed} testID="open-teams-loading" />
        ) : teams.length === 0 ? (
          <Text className="font-ui text-body text-text-secondary text-center mt-4">
            No open teams found.
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
                      <Text
                        className="font-ui font-semibold text-card-title text-ink-black"
                        numberOfLines={1}
                      >
                        {item.team_name}
                      </Text>
                      <Text className="text-text-secondary text-micro mt-0.5">
                        {item.home_city ?? 'City not set'} · {item.skill_level ?? 'Any level'} ·{' '}
                        {item.active_member_count} members
                      </Text>
                    </View>
                  </View>
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
                </View>
              );
            }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
