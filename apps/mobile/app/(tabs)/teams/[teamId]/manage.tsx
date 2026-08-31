import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { JoinRequest, TeamDetails } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';

// Team Management (PRD §12.3): invite/remove players, change captain, and
// respond to Join Team Requests (PRD §12.4). Captain-only — the backend
// re-enforces this regardless of what this screen shows.
export default function ManageTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitePlayerId, setInvitePlayerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamDetails, requests] = await Promise.all([
        apiClient.getTeamDetails(teamId),
        apiClient.getJoinRequests(teamId),
      ]);
      setTeam(teamDetails);
      setJoinRequests(requests.results);
    } catch {
      setError('Could not load team management data.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function withBusy(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (!invitePlayerId.trim()) return;
    await withBusy(async () => {
      await apiClient.inviteToTeam(teamId, invitePlayerId.trim());
      setInvitePlayerId('');
    });
  }

  if (loading || !team) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brandRed} testID="manage-team-loading" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface px-6 pt-6" testID="manage-team-screen">
      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
        Invite a Player
      </Text>
      <TextInput
        value={invitePlayerId}
        onChangeText={setInvitePlayerId}
        placeholder="Player ID"
        placeholderTextColor={colors.textTertiary}
        className="bg-surface-alt border border-border-strong rounded-md px-4 py-3 mb-3 font-ui text-body text-text-primary"
        testID="invite-player-id-input"
      />
      <View className="mb-6">
        <Button label="Send Invite" onPress={invite} loading={busy} testID="send-invite-button" />
      </View>

      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
        Members ({team.members.length})
      </Text>
      {team.members.map((member) => (
        <View
          key={member.team_member_id}
          className="flex-row items-center justify-between py-3 border-b border-border-subtle"
          testID={`manage-member-${member.player_id}`}
        >
          <View>
            <Text className="text-text-primary text-body">{member.bfam_id}</Text>
            {member.role_in_team === 'CAPTAIN' && (
              <Text className="text-brand-red text-micro uppercase">Captain</Text>
            )}
          </View>
          {member.role_in_team !== 'CAPTAIN' && (
            <View className="flex-row">
              <Pressable
                onPress={() => withBusy(() => apiClient.changeCaptain(teamId, member.player_id))}
                className="mr-4"
                testID={`make-captain-${member.player_id}`}
              >
                <Text className="text-text-secondary text-micro uppercase">Make Captain</Text>
              </Pressable>
              <Pressable
                onPress={() => withBusy(() => apiClient.removeTeamMember(teamId, member.player_id))}
                testID={`remove-member-${member.player_id}`}
              >
                <Text className="text-brand-red text-micro uppercase">Remove</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-6 mb-2">
        Pending Join Requests ({joinRequests.length})
      </Text>
      {joinRequests.length === 0 ? (
        <Text className="text-text-secondary text-body mb-8">No pending requests.</Text>
      ) : (
        joinRequests.map((request) => (
          <View
            key={request.request_id}
            className="flex-row items-center justify-between py-3 border-b border-border-subtle mb-8"
            testID={`join-request-${request.request_id}`}
          >
            <Text className="text-text-primary text-body">{request.bfam_id}</Text>
            <View className="flex-row">
              <Pressable
                onPress={() =>
                  withBusy(() =>
                    apiClient.respondToJoinRequest(request.request_id, true).then(() => undefined),
                  )
                }
                className="mr-4"
                testID={`accept-join-request-${request.request_id}`}
              >
                <Text className="text-brand-red text-micro uppercase">Accept</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  withBusy(() =>
                    apiClient.respondToJoinRequest(request.request_id, false).then(() => undefined),
                  )
                }
                testID={`reject-join-request-${request.request_id}`}
              >
                <Text className="text-text-tertiary text-micro uppercase">Reject</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
