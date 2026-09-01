import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { TeamDetails } from '@bfam/shared-types';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { useAuthStore } from '../../../../src/store/authStore';

// Team Details (PRD §12.3). Links out to Team Management only — Match
// Creation (module 2.6) is out of this module's scope.
export default function TeamDetailsScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getTeamDetails(teamId)
      .then(setTeam)
      .finally(() => setLoading(false));
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !team) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="team-details-loading" />
        </View>
      </ScreenContainer>
    );
  }

  const myMembership = team.members.find((m) => m.bfam_id === user?.bfam_id);
  const isCaptain = myMembership?.role_in_team === 'CAPTAIN';

  return (
    <ScrollView className="flex-1 bg-surface" testID="team-details-screen">
      <View className="px-6 pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">{team.team_name}</Text>
        <Text className="text-text-secondary text-body mt-1">
          {team.home_city ?? 'No home city set'} {team.skill_level ? `· ${team.skill_level}` : ''}
        </Text>
        {team.description && (
          <Text className="text-text-primary text-body mt-3">{team.description}</Text>
        )}

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-6 mb-2">
          Members ({team.members.length})
        </Text>
        {team.members.map((member) => (
          <View
            key={member.team_member_id}
            className="flex-row items-center justify-between py-3 border-b border-border-subtle"
            testID={`team-member-${member.player_id}`}
          >
            <Text className="text-text-primary text-body">{member.bfam_id}</Text>
            {member.role_in_team === 'CAPTAIN' && (
              <Text className="text-brand-red text-micro uppercase">Captain</Text>
            )}
          </View>
        ))}

        {isCaptain && (
          <View className="mt-6 mb-8">
            <Button
              label="Manage Team"
              onPress={() => router.push(`/(tabs)/teams/${teamId}/manage`)}
              testID="manage-team-button"
            />
          </View>
        )}

        {/* Match Creation is module 2.6 — this hands off to a stub only. */}
        <View className="mt-3 mb-10">
          <Button
            label="Create Match"
            variant="ghost"
            onPress={() => router.push('/(tabs)/teams/create-match-stub')}
            testID="create-match-stub-link"
          />
        </View>
      </View>
    </ScrollView>
  );
}
