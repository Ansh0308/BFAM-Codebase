import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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
        <Text className="font-display text-title-xl text-ink-black uppercase mb-4">My Teams</Text>

        <View className="mb-4">
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
          <Text className="font-ui text-body text-text-secondary text-center mt-4">
            You&apos;re not on a team yet.
          </Text>
        ) : (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.team_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(tabs)/teams/${item.team_id}`)}
                className="bg-surface-alt rounded-md border border-border-subtle p-4 mb-3"
                testID={`my-team-row-${item.team_id}`}
              >
                <Text className="font-ui font-bold text-text-primary text-button">
                  {item.team_name}
                </Text>
                <Text className="text-text-secondary text-body mt-1">
                  {item.home_city ?? 'No home city set'}
                </Text>
                {item.role_in_team === 'CAPTAIN' && (
                  <Text className="text-brand-red text-micro uppercase mt-2">Captain</Text>
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
