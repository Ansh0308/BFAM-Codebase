import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { BallLoader } from '../../../src/components/BallLoader';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { MyTeam } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';

// My Teams (PRD §12.3).
export default function MyTeamsScreen() {
  const router = useRouter();
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ScreenContainer>
      <View className="pt-6 flex-1" testID="my-teams-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">My Teams</Text>

        <View className="mb-3">
          <Button
            label="Create Team"
            onPress={() => router.push('/(tabs)/teams/create')}
            testID="create-team-button"
          />
        </View>
        <View className="mb-6">
          <Button
            label="Find Open Teams"
            variant="secondary"
            onPress={() => router.push('/(tabs)/teams/open')}
            testID="find-open-teams-button"
          />
        </View>

        {loading ? (
          <BallLoader testID="my-teams-loading" />
        ) : teams.length === 0 ? (
          <View className="items-center mt-8">
            <View
              className="rounded-full bg-surface-alt items-center justify-center mb-4"
              style={{ width: 64, height: 64 }}
            >
              <Feather name="users" size={26} color="#9A9A9A" />
            </View>
            <Text className="font-ui text-body text-text-secondary text-center">
              You&apos;re not on a team yet.
            </Text>
          </View>
        ) : (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.team_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/teams/${item.team_id}`)}
                className="flex-row items-center bg-surface rounded-lg border border-border-subtle p-4 mb-3"
                testID={`my-team-row-${item.team_id}`}
              >
                <View
                  className="rounded-full bg-surface-alt items-center justify-center mr-4"
                  style={{ width: 48, height: 48 }}
                >
                  <Feather name="users" size={20} color="#D80000" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text
                      className="font-ui font-semibold text-card-title text-ink-black"
                      numberOfLines={1}
                    >
                      {item.team_name}
                    </Text>
                    {item.role_in_team === 'CAPTAIN' && (
                      <View className="ml-2">
                        <StatusBadge label="Captain" variant="warning" />
                      </View>
                    )}
                  </View>
                  <Text className="text-text-secondary text-body mt-0.5">
                    {item.home_city ?? 'No home city set'}
                  </Text>
                </View>
                {/* Backlog A-11: copy this team's details into a brand-new
                    Create Team form — minimal-clicks alternative to
                    starting from scratch, same precedent as Rebook Same
                    Players (module 2.10). */}
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation();
                    router.push({
                      pathname: '/(tabs)/teams/create',
                      params: {
                        copyFromTeamName: item.team_name,
                        copyFromDescription: item.description ?? '',
                        copyFromHomeCity: item.home_city ?? '',
                        copyFromSkillLevel: item.skill_level ?? '',
                        copyFromIsOpen: String(item.is_open_for_players),
                      },
                    });
                  }}
                  className="rounded-full bg-surface-alt items-center justify-center mr-2"
                  style={{ width: 34, height: 34 }}
                  testID={`copy-team-${item.team_id}`}
                  accessibilityLabel={`Copy ${item.team_name} into a new team`}
                  hitSlop={8}
                >
                  <Feather name="copy" size={16} color="#D80000" />
                </Pressable>
                <Feather name="chevron-right" size={20} color="#9A9A9A" />
              </Pressable>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
