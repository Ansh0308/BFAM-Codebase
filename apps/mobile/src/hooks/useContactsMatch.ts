import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import type { ContactMatch } from '@bfam/shared-types';
import { BFAMApiError } from '@bfam/api-client';
import { apiClient } from '../lib/apiClient';

// The server matches on the last 10 digits of a number, takes at most 2000 numbers per request
// and rejects the WHOLE request if any single number is over 30 characters. A real phonebook
// has numbers with extensions, toll-free lines and thousands of entries, so the lookup is
// cleaned, de-duplicated and sent in batches instead of in one go.
const LOOKUP_BATCH = 500;
const CONTACTS_PAGE = 200;
const MAX_CONTACTS = 20000;

export function matchKey(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

// What to send for a contact: its number as written when that is usable, otherwise just the
// digits (the server only looks at the last 10).
function numberToSend(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 30) return trimmed;
  return raw.replace(/\D/g, '').slice(-15);
}

export function describeContactsFailure(error: unknown): string {
  const base = 'Could not check your contacts. Please try again.';
  if (error instanceof BFAMApiError) {
    if (error.status === 401) return 'Your session has expired. Please log in again.';
    if (error.status === 429) return 'Too many tries. Please wait a minute and try again.';
    return `Could not check your contacts (${error.message}). Please try again.`;
  }
  const detail = error instanceof Error ? error.message.trim().slice(0, 90) : '';
  return detail ? `Could not check your contacts (${detail}). Please try again.` : base;
}

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
    // One row per distinct number: a person saved twice must not show up twice.
    const seenKeys = new Set<string>();
    const usable = picked.filter((c) => {
      const key = matchKey(c.phoneNumber);
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    if (usable.length === 0) {
      if (!append) setContacts([]);
      return;
    }
    const toSend = usable.map((c) => numberToSend(c.phoneNumber));
    const results: ContactMatch[] = [];
    for (let i = 0; i < toSend.length; i += LOOKUP_BATCH) {
      const res = await apiClient.matchContacts(toSend.slice(i, i + LOOKUP_BATCH));
      results.push(...res.results);
    }
    const byKey = new Map<string, ContactMatch>();
    for (const m of results) {
      const key = matchKey(m.phone_number);
      if (key) byKey.set(key, m);
    }
    const next = usable.map((c) => {
      const match = byKey.get(matchKey(c.phoneNumber) ?? '') ?? null;
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

      // Read the phonebook a page at a time: asking Android for thousands of contacts at once
      // can fail outright ("row too big to fit into CursorWindow").
      const data: Contacts.ExistingContact[] = [];
      for (let offset = 0; data.length < MAX_CONTACTS; offset += CONTACTS_PAGE) {
        const page = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
          pageSize: CONTACTS_PAGE,
          pageOffset: offset,
        });
        data.push(...page.data);
        if (!page.hasNextPage) break;
      }
      // One row per contact that has at least one phone number — takes the
      // first number for a contact with several, which is enough to
      // identify them for an invite.
      const withNumbers = data
        .map((contact, index) => ({
          id: contact.id ?? String(index),
          name: contact.name || 'Unknown',
          // The first number that is a real phone number, not just the first one saved.
          phoneNumber:
            contact.phoneNumbers?.find((p) => p.number && matchKey(p.number))?.number ??
            contact.phoneNumbers?.[0]?.number,
        }))
        .filter((c): c is { id: string; name: string; phoneNumber: string } =>
          Boolean(c.phoneNumber),
        );

      await matchAndStore(withNumbers, false);
      setStatus('ready');
    } catch (caught) {
      setError(describeContactsFailure(caught));
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
