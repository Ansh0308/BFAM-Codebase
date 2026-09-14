import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, TextInput, View } from 'react-native';
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

// Demo-only join link — swap for the real Play Store listing once BFAM
// launches; the share message is written so it still reads fine either way.
const INVITE_LINK = 'https://bfam.app/join-demo';

// Contacts-Based Invites (backlog B-2, extended): a "check my contacts"
// action that, once granted, matches the device's phone contacts against
// registered BFAM players and lets the captain/organizer invite anyone
// found directly — and, for a contact who isn't on BFAM yet, share an
// install-and-join link instead. Searchable by the contact's own name so a
// long phonebook doesn't have to be scanned by eye. Re-used identically by
// Team invites (manage.tsx) and Match invites (invite.tsx).
export function ContactsInviteSection({
  invitedIds,
  busy,
  onInvite,
  testIDPrefix = 'contacts',
}: ContactsInviteSectionProps) {
  const { status, contacts, error, load } = useContactsMatch();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, search]);

  function inviteViaLink(name: string) {
    Share.share({
      message: `Hey ${name}, join me for cricket on BFAM! Install the app and join my team: ${INVITE_LINK}`,
    });
  }

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
        (contacts.length === 0 ? (
          <Text className="font-ui text-body text-text-secondary mb-6">
            No contacts with a phone number were found.
          </Text>
        ) : (
          <>
            <View
              className="mb-3 flex-row items-center bg-surface-alt rounded-md px-3"
              style={{ height: 40 }}
            >
              <Feather name="search" size={14} color="#767676" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search contacts by name"
                placeholderTextColor="#9C9C9C"
                className="flex-1 ml-2 font-ui text-body text-text-primary"
                testID={`${testIDPrefix}-contact-search-input`}
              />
            </View>

            {filtered.length === 0 ? (
              <Text className="font-ui text-body text-text-secondary mb-6">
                No contacts match &quot;{search}&quot;.
              </Text>
            ) : (
              filtered.map((contact) => {
                if (contact.match) {
                  const playerId = contact.match.player_id;
                  const invited = invitedIds.has(playerId);
                  return (
                    <View
                      key={contact.id}
                      className="flex-row items-center justify-between py-3 border-b border-border-subtle"
                      testID={`${testIDPrefix}-contact-row-${playerId}`}
                    >
                      <View className="flex-row items-center flex-1">
                        <Avatar size={36} />
                        <Text className="text-text-primary text-body ml-3" numberOfLines={1}>
                          {contact.name}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => onInvite(contact.match!)}
                        disabled={invited || busy}
                        testID={`${testIDPrefix}-invite-button-${playerId}`}
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
                }
                return (
                  <View
                    key={contact.id}
                    className="flex-row items-center justify-between py-3 border-b border-border-subtle"
                    testID={`${testIDPrefix}-contact-row-unmatched-${contact.id}`}
                  >
                    <View className="flex-row items-center flex-1">
                      <Avatar size={36} />
                      <View className="ml-3 flex-1">
                        <Text className="text-text-primary text-body" numberOfLines={1}>
                          {contact.name}
                        </Text>
                        <Text className="font-ui text-micro text-text-tertiary">
                          Not on BFAM yet
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => inviteViaLink(contact.name)}
                      testID={`${testIDPrefix}-invite-link-button-${contact.id}`}
                    >
                      <Text className="font-ui text-micro font-bold uppercase text-ink-black">
                        Invite via Link
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        ))}
    </View>
  );
}
