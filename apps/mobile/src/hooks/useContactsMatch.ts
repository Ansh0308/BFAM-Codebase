import { useCallback, useState } from 'react';
import * as Contacts from 'expo-contacts';
import type { ContactMatch } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';

export type ContactsMatchStatus = 'idle' | 'loading' | 'denied' | 'error' | 'ready';

// Contacts-Based Invites (backlog B-2): requests the device Contacts
// permission, reads only phone numbers (never names, photos, or any other
// contact field) off the device, and sends that batch to
// POST /players/contacts-lookup to find out which of them are already on
// BFAM. The device contact list itself never leaves this function — only
// the phone numbers do, and only the ones that come back matched are ever
// shown or held onto.
export function useContactsMatch() {
  const [status, setStatus] = useState<ContactsMatchStatus>('idle');
  const [matches, setMatches] = useState<ContactMatch[]>([]);
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

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      const phoneNumbers = data.flatMap((contact) =>
        (contact.phoneNumbers ?? []).map((p) => p.number).filter((n): n is string => Boolean(n)),
      );
      if (phoneNumbers.length === 0) {
        setMatches([]);
        setStatus('ready');
        return;
      }

      const { results } = await apiClient.matchContacts(phoneNumbers);
      setMatches(results);
      setStatus('ready');
    } catch {
      setError('Could not check your contacts. Please try again.');
      setStatus('error');
    }
  }, []);

  return { status, matches, error, load };
}
