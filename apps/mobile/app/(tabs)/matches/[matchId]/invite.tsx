import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { MyTeam, TeamMember } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../../../../src/lib/apiClient';
import { colors } from '../../../../src/theme/tokens';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { Avatar } from '../../../../src/components/Avatar';

// Invite Players (PRD §12.11): team members, direct player ID, share
// link, and a dedicated WhatsApp share action. There's no native Contacts
// picker here — team roster + player ID cover the app-internal invite
// paths; a true phone-contacts integration is a separate scope decision
// (needs its own permission flow) left for a follow-up.
export default function InvitePlayersScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [playerId, setPlayerId] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMyTeams()
      .then(async (res) => {
        setTeams(res.results);
        if (res.results.length > 0) {
          const details = await apiClient.getTeamDetails(res.results[0].team_id);
          setTeamMembers(details.members);
        }
      })
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  }, []);

  async function invite(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.inviteToMatch(matchId, id);
      setInvitedIds((prev) => new Set(prev).add(id));
    } catch (err) {
      if (err instanceof BFAMApiError) setError(err.message);
      else setError('Could not send the invite.');
    } finally {
      setBusy(false);
    }
  }

  const shareMessage = `Join my cricket match on BFAM! Open the app, go to Matches, and use match ID ${matchId} to join.`;

  return (
    <ScreenContainer scroll>
      <View className="pt-4" testID="invite-players-screen">
        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Invite by Player ID
        </Text>
        <TextField
          label=""
          value={playerId}
          onChangeText={setPlayerId}
          placeholder="Player ID"
          iconLeft={<Feather name="user-plus" size={16} color="#767676" />}
          testID="invite-player-id-input"
        />
        <View className="mb-6">
          <Button
            label="Send Invite"
            onPress={() => playerId.trim() && invite(playerId.trim()).then(() => setPlayerId(''))}
            loading={busy}
            testID="send-player-id-invite"
          />
        </View>

        {error && <Text className="text-brand-red text-body mb-4">{error}</Text>}

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          Share
        </Text>
        <View className="mb-2">
          <Button
            label="Share Link"
            variant="secondary"
            iconLeft={<Feather name="share-2" size={16} color="#0D0D0D" />}
            onPress={() => Share.share({ message: shareMessage })}
            testID="share-link-button"
          />
        </View>
        <View className="mb-6">
          <Button
            label="Share via WhatsApp"
            variant="secondary"
            iconLeft={<Feather name="message-circle" size={16} color="#0D0D0D" />}
            onPress={() =>
              Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`).catch(
                () => Share.share({ message: shareMessage }),
              )
            }
            testID="share-whatsapp-button"
          />
        </View>

        <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
          From Your Team
        </Text>
        {loadingTeams ? (
          <ActivityIndicator color={colors.brandRed} testID="invite-teams-loading" />
        ) : teams.length === 0 ? (
          <Text className="font-ui text-body text-text-secondary mb-8">
            You&apos;re not on a team yet.
          </Text>
        ) : teamMembers.length === 0 ? (
          <Text className="font-ui text-body text-text-secondary mb-8">
            No other members on your team yet.
          </Text>
        ) : (
          teamMembers.map((member) => {
            const invited = invitedIds.has(member.player_id);
            return (
              <View
                key={member.team_member_id}
                className="flex-row items-center justify-between py-3 border-b border-border-subtle"
                testID={`invite-team-member-${member.player_id}`}
              >
                <View className="flex-row items-center">
                  <Avatar size={36} />
                  <Text className="text-text-primary text-body ml-3">{member.bfam_id}</Text>
                </View>
                <Pressable
                  onPress={() => invite(member.player_id)}
                  disabled={invited || busy}
                  testID={`invite-button-${member.player_id}`}
                >
                  <Text
                    className={[
                      'font-ui text-micro font-bold uppercase',
                      invited ? 'text-text-tertiary' : 'text-brand-red',
                    ].join(' ')}
                  >
                    {invited ? 'Invited' : 'Invite'}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
        <View className="mb-10" />
      </View>
    </ScreenContainer>
  );
}
