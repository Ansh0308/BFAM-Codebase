import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { MyTeam, TeamDetails } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../../src/components/StatusBadge';
import { Button } from '../../../../src/components/Button';
import { Avatar } from '../../../../src/components/Avatar';
import { useAuthStore } from '../../../../src/store/authStore';

// Team Details (PRD §12.3). Links out to Team Management only — Match
// Creation (module 2.6) is out of this module's scope.
export default function TeamDetailsScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [myCaptainedTeams, setMyCaptainedTeams] = useState<MyTeam[]>([]);
  const [challengingTeamId, setChallengingTeamId] = useState<string | null>(null);
  const [challengeSentIds, setChallengeSentIds] = useState<Set<string>>(new Set());
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([apiClient.getTeamDetails(teamId), apiClient.getMyTeams()])
      .then(([teamDetails, myTeams]) => {
        setTeam(teamDetails);
        setMyCaptainedTeams(myTeams.results.filter((t) => t.role_in_team === 'CAPTAIN'));
      })
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
  // Backlog B-13: a team I don't captain, open for challenges, and I
  // captain at least one team of my own to challenge with.
  const challengeableFromTeams = myCaptainedTeams.filter((t) => t.team_id !== teamId);
  const canChallenge = team.is_open_for_challenge && challengeableFromTeams.length > 0;

  async function sendChallengeFrom(myTeamId: string) {
    setChallengingTeamId(myTeamId);
    setChallengeError(null);
    try {
      await apiClient.sendChallenge(myTeamId, teamId);
      setChallengeSentIds((prev) => new Set(prev).add(myTeamId));
    } catch (err) {
      if (err instanceof BFAMApiError) setChallengeError(err.message);
      else setChallengeError('Could not send the challenge. Please try again.');
    } finally {
      setChallengingTeamId(null);
    }
  }

  return (
    <ScrollView className="flex-1 bg-surface" testID="team-details-screen">
      <View className="px-6 pt-6">
        <Text className="font-ui font-bold text-title-xl text-ink-black">{team.team_name}</Text>
        <View className="flex-row items-center mt-1">
          <Feather name="map-pin" size={13} color="#767676" />
          <Text className="text-text-secondary text-body ml-1">
            {team.home_city ?? 'No home city set'} {team.skill_level ? `· ${team.skill_level}` : ''}
          </Text>
        </View>
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
            <View className="flex-row items-center">
              <Avatar size={36} />
              <Text className="text-text-primary text-body ml-3">{member.bfam_id}</Text>
            </View>
            {member.role_in_team === 'CAPTAIN' && <StatusBadge label="Captain" variant="warning" />}
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

        {/* Backlog B-13: Team vs Team Challenge Mode. */}
        {canChallenge && (
          <View className="mt-3 mb-2" testID="challenge-team-section">
            <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
              Challenge This Team
            </Text>
            {challengeError && (
              <Text className="text-brand-red text-body mb-2">{challengeError}</Text>
            )}
            {challengeableFromTeams.map((myTeam) => {
              const sent = challengeSentIds.has(myTeam.team_id);
              return (
                <Button
                  key={myTeam.team_id}
                  label={
                    sent
                      ? `Challenge Sent (${myTeam.team_name})`
                      : `Challenge with ${myTeam.team_name}`
                  }
                  variant={sent ? 'ghost' : 'primary'}
                  disabled={sent}
                  loading={challengingTeamId === myTeam.team_id}
                  onPress={() => sendChallengeFrom(myTeam.team_id)}
                  testID={`challenge-this-team-${myTeam.team_id}`}
                />
              );
            })}
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
