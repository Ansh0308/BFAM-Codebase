import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import type { ContactMatch } from '@bfam/shared-types';
import { apiClient } from '../lib/apiClient';

export type ContactsMatchStatus =
  | 'idle'
  | 'loading'
  | 'denied'
  | 'error'
  | 'ready'
  // The browser has no way to read contacts (iPhone Safari, desktop): the list
  // stays usable through "find a player by phone number" instead.
  | 'unsupported';

export interface MatchedContact {
  id: string;
  name: string;
  phoneNumber: string;
  match: ContactMatch | null;
}

type PickedContact = { id: string; name: string; phoneNumber: string };

// The web's Contact Picker API (Chrome on Android): the browser shows its own
// multi-select contact list and only what the person ticks is handed to the
// page. It is the web equivalent of the phone's Contacts permission prompt.
interface WebContactPicker {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<{ name?: string[]; tel?: string[] }[]>;
}

function webContactPicker(): WebContactPicker | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const contacts = (navigator as unknown as { contacts?: WebContactPicker }).contacts;
  const supported =
    contacts &&
    typeof contacts.select === 'function' &&
    typeof window !== 'undefined' &&
    'ContactsManager' in window;
  return supported ? (contacts as WebContactPicker) : null;
}

// True when this browser can open the contact list (the check is repeated at
// press time; this lets the UI choose what to offer up front).
export function canPickContactsOnWeb(): boolean {
  return webContactPicker() !== null;
}

// Contacts-Based Invites (backlog B-2, extended): reads names + phone numbers
// the person chooses to share (the phone's Contacts permission, or the browser's
// contact picker on Android Chrome) and sends only the phone numbers to
// POST /players/contacts-lookup to find out which are already on BFAM. Contact
// names never leave the device — they're only ever kept in this hook's own local
// state, which is what lets the invite list be searched by name and lets a
// contact who isn't on BFAM yet still be identified for an "invite via link"
// fallback.
export function useContactsMatch() {
  const [status, setStatus] = useState<ContactsMatchStatus>('idle');
  const [contacts, setContacts] = useState<MatchedContact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const matchAndStore = useCallback(async (picked: PickedContact[], append: boolean) => {
    if (picked.length === 0) {
      if (!append) setContacts([]);
      return;
    }
    const { results } = await apiClient.matchContacts(picked.map((c) => c.phoneNumber));
    const byNumber = new Map(results.map((m) => [m.phone_number, m]));
    const next = picked.map((c) => {
      const match = byNumber.get(c.phoneNumber) ?? null;
      // A number typed in by hand has no contact name; show the player it belongs to.
      const name =
        match && c.id.startsWith('manual-') ? (match.full_name ?? match.bfam_id) : c.name;
      return { ...c, name, match };
    });
    setContacts((existing) => {
      if (!append) return next;
      const known = new Set(existing.map((c) => c.phoneNumber));
      return [...next.filter((c) => !known.has(c.phoneNumber)), ...existing];
    });
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const picker = webContactPicker();
        if (!picker) {
          setStatus('unsupported');
          return;
        }
        let selected: { name?: string[]; tel?: string[] }[];
        try {
          selected = await picker.select(['name', 'tel'], { multiple: true });
        } catch (pickerError) {
          const name = (pickerError as { name?: string })?.name;
          // Closing the picker or refusing access is not a failure.
          setStatus(name === 'NotAllowedError' || name === 'AbortError' ? 'denied' : 'error');
          if (name !== 'NotAllowedError' && name !== 'AbortError') {
            setError('Could not open your contacts. Please try again.');
          }
          return;
        }
        apiClient.recordConsent('CONTACTS').catch(() => {});
        const picked = selected
          .map((c, index) => ({
            id: `web-${index}-${c.tel?.[0] ?? ''}`,
            name: c.name?.[0] || 'Unknown',
            phoneNumber: c.tel?.[0] ?? '',
          }))
          .filter((c) => Boolean(c.phoneNumber));
        await matchAndStore(picked, false);
        setStatus('ready');
        return;
      }

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

      await matchAndStore(withNumbers, false);
      setStatus('ready');
    } catch {
      setError('Could not check your contacts. Please try again.');
      setStatus('error');
    }
  }, [matchAndStore]);

  // "Find a player by phone number": the way to add someone on a browser that
  // cannot read contacts, and a shortcut for anyone not in the phonebook.
  // Returns an error message for the caller to show, or null on success.
  const addByPhone = useCallback(
    async (rawNumber: string): Promise<string | null> => {
      const digits = rawNumber.replace(/[^\d+]/g, '');
      if (digits.replace(/\D/g, '').length < 10) {
        return 'Enter the full 10-digit mobile number.';
      }
      try {
        await matchAndStore(
          [{ id: `manual-${digits}`, name: rawNumber.trim(), phoneNumber: digits }],
          true,
        );
        setStatus('ready');
        return null;
      } catch {
        return 'Could not look that number up. Please try again.';
      }
    },
    [matchAndStore],
  );

  return { status, contacts, error, load, addByPhone };
}
