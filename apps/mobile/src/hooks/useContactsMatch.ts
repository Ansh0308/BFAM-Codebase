import { useCallback, useState } from 'react';
import * as Contacts from 'expo-contacts';
import type { ContactMatch } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';

export type ContactsMatchStatus = 'idle' | 'loading' | 'denied' | 'error' | 'ready';

export interface MatchedContact {
  id: string;
  name: string;
  phoneNumber: string;
  match: ContactMatch | null;
}

// Contacts-Based Invites (backlog B-2, extended): requests the device
// Contacts permission, reads names + phone numbers off the device, and
// sends only the phone numbers to POST /players/contacts-lookup to find
// out which of them are already on BFAM. Contact names never leave the
// device — they're only ever kept in this hook's own local state, which
// is what lets the invite list be searched by name and lets a contact who
// isn't on BFAM yet still be identified for an "invite via link" fallback.
export function useContactsMatch() {
  const [status, setStatus] = useState<ContactsMatchStatus>('idle');
  const [contacts, setContacts] = useState<MatchedContact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { status: permissionStatus } = await Contacts.requestPermissionsAsync();
      if (permissionStatus !== 'granted') {
        setStatus('denied');
        return;
      }
      // Backlog G-21: log a versioned consent record the moment the device
      // actually grants Contacts access — best-effort, never blocks the
      // feature itself if it fails.
      apiClient.recordConsent('CONTACTS').catch(() => {});

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      // One row per contact that has at least one phone number — takes the
      // first number for a contact with several, which is enough to
      // identify them for an invite.
      const withNumbers = data
        .map((contact, index) => ({
          id: contact.id ?? String(index),
          name: contact.name || 'Unknown',
          phoneNumber: contact.phoneNumbers?.[0]?.number,
        }))
        .filter((c): c is { id: string; name: string; phoneNumber: string } =>
          Boolean(c.phoneNumber),
        );

      if (withNumbers.length === 0) {
        setContacts([]);
        setStatus('ready');
        return;
      }

      const { results } = await apiClient.matchContacts(withNumbers.map((c) => c.phoneNumber));
      const byNumber = new Map(results.map((m) => [m.phone_number, m]));
      setContacts(withNumbers.map((c) => ({ ...c, match: byNumber.get(c.phoneNumber) ?? null })));
      setStatus('ready');
    } catch {
      setError('Could not check your contacts. Please try again.');
      setStatus('error');
    }
  }, []);

  return { status, contacts, error, load };
}
