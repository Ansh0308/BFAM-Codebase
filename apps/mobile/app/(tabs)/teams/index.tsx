import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { MyTeam } from '@bfam/shared-types';
import { apiClient } from '../../../src/lib/apiClient';
import { colors } from '../../../src/theme/tokens';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
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
          <ActivityIndicator size="large" color={colors.brandRed} testID="my-teams-loading" />
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
                      <View className="ml-2 rounded-full border border-brand-red px-2 py-0.5">
                        <Text className="font-ui text-micro font-bold text-brand-red">Captain</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-text-secondary text-body mt-0.5">
                    {item.home_city ?? 'No home city set'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#9A9A9A" />
              </Pressable>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
