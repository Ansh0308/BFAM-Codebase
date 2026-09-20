import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { JoinRequest, TeamChallenge, TeamDetails } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { Avatar } from '../../../../src/components/Avatar';
import { ContactsInviteSection } from '../../../../src/components/ContactsInviteSection';
import { StatusBadge } from '../../../../src/components/StatusBadge';
import { ToggleRow } from '../../../../src/components/ToggleRow';
import { useChallengeMatchStore } from '../../../../src/store/challengeMatchStore';

// Team Management (PRD §12.3): invite/remove players, change captain, and
// respond to Join Team Requests (PRD §12.4). Captain-only — the backend
// re-enforces this regardless of what this screen shows. Backlog B-2 adds
// checking the captain's device contacts against registered players as a
// third invite path, alongside BFAM ID entry.
export default function ManageTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const setChallengeMatchPlan = useChallengeMatchStore((s) => s.setPlan);
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [challenges, setChallenges] = useState<TeamChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitePlayerId, setInvitePlayerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Contacts invites don't add a member immediately (they create a
  // team_invitations row, same as BFAM ID invite) — tracked locally so the
  // "Invite" button flips to "Invited" for this session without needing a
  // dedicated pending-invites list on this screen.
  const [contactInvitedIds, setContactInvitedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamDetails, requests, myChallenges] = await Promise.all([
        apiClient.getTeamDetails(teamId),
        apiClient.getJoinRequests(teamId),
        apiClient.getMyChallenges(),
      ]);
      setTeam(teamDetails);
      setJoinRequests(requests.results);
      // Backlog B-13: getMyChallenges returns every challenge involving any
      // team this captain runs — narrow to this specific team.
      setChallenges(
        myChallenges.results.filter(
          (c) => c.challenging_team_id === teamId || c.challenged_team_id === teamId,
        ),
      );
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

  async function inviteFromContacts(playerId: string, bfamId: string) {
    await withBusy(async () => {
      await apiClient.inviteToTeam(teamId, bfamId);
      setContactInvitedIds((prev) => new Set(prev).add(playerId));
    });
  }

  async function toggleOpenForChallenge(nextValue: boolean) {
    await withBusy(() => apiClient.setOpenForChallenge(teamId, nextValue).then(() => undefined));
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
      <TextField
        label="Invite a Player"
        value={invitePlayerId}
        onChangeText={setInvitePlayerId}
        placeholder="BFAM ID, e.g. BF1001"
        autoCapitalize="characters"
        iconLeft={<Feather name="user-plus" size={16} color="#767676" />}
        testID="invite-player-id-input"
      />
      <View className="mb-6">
        <Button label="Send Invite" onPress={invite} loading={busy} testID="send-invite-button" />
      </View>

      {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

      <ContactsInviteSection
        invitedIds={contactInvitedIds}
        busy={busy}
        onInvite={(match) => inviteFromContacts(match.player_id, match.bfam_id)}
        testIDPrefix="team-invite"
      />

      {/* Backlog B-13: Team vs Team Challenge Mode. */}
      <ToggleRow
        label="Open for Challenge"
        description="Let other teams challenge this team to a match."
        value={team.is_open_for_challenge}
        onValueChange={toggleOpenForChallenge}
        disabled={busy}
        testID="open-for-challenge-toggle"
      />

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-6 mb-2">
        Challenges ({challenges.length})
      </Text>
      {challenges.length === 0 ? (
        <Text className="text-text-secondary text-body mb-8">No challenges yet.</Text>
      ) : (
        challenges.map((challenge) => {
          const incoming = challenge.challenged_team_id === teamId;
          const otherTeamName = incoming
            ? challenge.challenging_team_name
            : challenge.challenged_team_name;
          return (
            <View
              key={challenge.challenge_id}
              className="flex-row items-center justify-between py-3 border-b border-border-subtle mb-2"
              testID={`challenge-row-${challenge.challenge_id}`}
            >
              <View className="flex-1 pr-3">
                <Text className="text-text-primary text-body">
                  {incoming ? `Challenge from ${otherTeamName}` : `Challenged ${otherTeamName}`}
                </Text>
                <StatusBadge
                  label={challenge.status}
                  variant={
                    challenge.status === 'ACCEPTED'
                      ? 'success'
                      : challenge.status === 'DECLINED' || challenge.status === 'CANCELLED'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </View>
              {challenge.status === 'PENDING' && incoming && (
                <View className="flex-row items-center">
                  <Pressable
                    onPress={() =>
                      withBusy(() =>
                        apiClient
                          .respondToChallenge(challenge.challenge_id, true)
                          .then(() => undefined),
                      )
                    }
                    className="mr-3 rounded-full bg-brand-red items-center justify-center"
                    style={{ width: 34, height: 34 }}
                    testID={`accept-challenge-${challenge.challenge_id}`}
                    accessibilityLabel="Accept challenge"
                  >
                    <Feather name="check" size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      withBusy(() =>
                        apiClient
                          .respondToChallenge(challenge.challenge_id, false)
                          .then(() => undefined),
                      )
                    }
                    className="rounded-full bg-surface-alt items-center justify-center"
                    style={{ width: 34, height: 34 }}
                    testID={`decline-challenge-${challenge.challenge_id}`}
                    accessibilityLabel="Decline challenge"
                  >
                    <Feather name="x" size={16} color="#767676" />
                  </Pressable>
                </View>
              )}
              {challenge.status === 'PENDING' && !incoming && (
                <Pressable
                  onPress={() =>
                    withBusy(() =>
                      apiClient.cancelChallenge(challenge.challenge_id).then(() => undefined),
                    )
                  }
                  className="rounded-full bg-surface-alt items-center justify-center"
                  style={{ width: 34, height: 34 }}
                  testID={`cancel-challenge-${challenge.challenge_id}`}
                  accessibilityLabel="Cancel challenge"
                >
                  <Feather name="x" size={16} color="#767676" />
                </Pressable>
              )}
              {challenge.status === 'ACCEPTED' && (
                <Pressable
                  onPress={() => {
                    setChallengeMatchPlan({
                      home_team_id: challenge.challenging_team_id,
                      home_team_name: challenge.challenging_team_name,
                      away_team_id: challenge.challenged_team_id,
                      away_team_name: challenge.challenged_team_name,
                    });
                    router.push('/(tabs)/matches/create');
                  }}
                  className="rounded-md bg-brand-red px-3 py-2"
                  testID={`create-match-from-challenge-${challenge.challenge_id}`}
                >
                  <Text className="font-ui font-bold text-micro text-white uppercase">
                    Create Match
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}

      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mt-6 mb-2">
        Members ({team.members.length})
      </Text>
      {team.members.map((member) => (
        <View
          key={member.team_member_id}
          className="flex-row items-center justify-between py-3 border-b border-border-subtle"
          testID={`manage-member-${member.player_id}`}
        >
          <Pressable
            className="flex-row items-center flex-1"
            onPress={() => router.push(`/player-profile?playerId=${member.player_id}`)}
            testID={`manage-member-avatar-${member.player_id}`}
          >
            <Avatar size={36} />
            <View className="ml-3">
              <Text className="text-text-primary text-body">
                {member.full_name || member.bfam_id}
              </Text>
              {member.role_in_team === 'CAPTAIN' && (
                <View className="mt-1 self-start">
                  <StatusBadge label="Captain" variant="warning" />
                </View>
              )}
            </View>
          </Pressable>
          {member.role_in_team !== 'CAPTAIN' && (
            <View className="flex-row items-center">
              <Pressable
                onPress={() => withBusy(() => apiClient.changeCaptain(teamId, member.player_id))}
                className="mr-3 rounded-full bg-surface-alt items-center justify-center"
                style={{ width: 34, height: 34 }}
                testID={`make-captain-${member.player_id}`}
                accessibilityLabel="Make captain"
              >
                <Feather name="star" size={16} color="#0D0D0D" />
              </Pressable>
              <Pressable
                onPress={() => withBusy(() => apiClient.removeTeamMember(teamId, member.player_id))}
                className="rounded-full bg-surface-alt items-center justify-center"
                style={{ width: 34, height: 34 }}
                testID={`remove-member-${member.player_id}`}
                accessibilityLabel="Remove from team"
              >
                <Feather name="user-x" size={16} color="#D80000" />
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
            <View className="flex-row items-center">
              <Avatar size={36} />
              <Text className="text-text-primary text-body ml-3">{request.bfam_id}</Text>
            </View>
            <View className="flex-row items-center">
              <Pressable
                onPress={() =>
                  withBusy(() =>
                    apiClient.respondToJoinRequest(request.request_id, true).then(() => undefined),
                  )
                }
                className="mr-3 rounded-full bg-brand-red items-center justify-center"
                style={{ width: 34, height: 34 }}
                testID={`accept-join-request-${request.request_id}`}
                accessibilityLabel="Accept"
              >
                <Feather name="check" size={16} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() =>
                  withBusy(() =>
                    apiClient.respondToJoinRequest(request.request_id, false).then(() => undefined),
                  )
                }
                className="rounded-full bg-surface-alt items-center justify-center"
                style={{ width: 34, height: 34 }}
                testID={`reject-join-request-${request.request_id}`}
                accessibilityLabel="Reject"
              >
                <Feather name="x" size={16} color="#767676" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
