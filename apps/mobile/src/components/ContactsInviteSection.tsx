import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ContactMatch } from '@bfam/shared-types';
import { colors } from '../theme/tokens';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useContactsMatch } from '../hooks/useContactsMatch';

interface ContactsInviteSectionProps {
  invitedIds: Set<string>;
  busy: boolean;
  onInvite: (match: ContactMatch) => void;
  testIDPrefix?: string;
}

function displayName(m: ContactMatch): string {
  return m.full_name || m.bfam_id;
}

// Contacts-Based Invites (backlog B-2): a "check my contacts" action that,
// once granted, matches the device's phone contacts against registered
// BFAM players and lets the captain/organizer invite anyone found —
// re-used identically by Team invites (manage.tsx) and Match invites
// (invite.tsx), the two places the feedback asked for this.
export function ContactsInviteSection({
  invitedIds,
  busy,
  onInvite,
  testIDPrefix = 'contacts',
}: ContactsInviteSectionProps) {
  const { status, matches, error, load } = useContactsMatch();

  return (
    <View testID={`${testIDPrefix}-invite-section`}>
      <Text className="font-ui font-bold text-text-secondary text-micro uppercase mb-2">
        From Your Contacts
      </Text>

      {status === 'idle' && (
        <View className="mb-6">
          <Button
            label="Check Contacts for Players"
            variant="secondary"
            iconLeft={<Feather name="users" size={16} color="#0D0D0D" />}
            onPress={load}
            testID={`${testIDPrefix}-check-contacts-button`}
          />
        </View>
      )}

      {status === 'loading' && (
        <ActivityIndicator
          color={colors.brandRed}
          testID={`${testIDPrefix}-contacts-loading`}
          style={{ marginBottom: 24 }}
        />
      )}

      {status === 'denied' && (
        <Text
          className="font-ui text-body text-text-secondary mb-6"
          testID={`${testIDPrefix}-contacts-denied`}
        >
          BFAM needs permission to read your contacts&apos; phone numbers to find players you know.
          You can allow it from your phone&apos;s Settings.
        </Text>
      )}

      {status === 'error' && (
        <View className="mb-6">
          <Text className="font-ui text-body text-brand-red-dark mb-2">{error}</Text>
          <Button
            label="Try Again"
            variant="secondary"
            onPress={load}
            testID={`${testIDPrefix}-retry-contacts-button`}
          />
        </View>
      )}

      {status === 'ready' &&
        (matches.length === 0 ? (
          <Text className="font-ui text-body text-text-secondary mb-6">
            None of your contacts are on BFAM yet.
          </Text>
        ) : (
          matches.map((match) => {
            const invited = invitedIds.has(match.player_id);
            return (
              <View
                key={match.player_id}
                className="flex-row items-center justify-between py-3 border-b border-border-subtle"
                testID={`${testIDPrefix}-contact-row-${match.player_id}`}
              >
                <View className="flex-row items-center">
                  <Avatar size={36} />
                  <Text className="text-text-primary text-body ml-3">{displayName(match)}</Text>
                </View>
                <Pressable
                  onPress={() => onInvite(match)}
                  disabled={invited || busy}
                  testID={`${testIDPrefix}-invite-button-${match.player_id}`}
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
        ))}
    </View>
  );
}
