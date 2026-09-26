import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

// The deployed site is a web build, where expo-contacts does not exist: the
// "Check Contacts" button could never work. Chrome on Android offers the Contact
// Picker API instead; every other browser gets "add a player by phone number".

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    matchContacts: jest.fn(),
    recordConsent: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRequestPermissionsAsync = jest.fn();
const mockGetContactsAsync = jest.fn();
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getContactsAsync: (...args: unknown[]) => mockGetContactsAsync(...args),
  Fields: { PhoneNumbers: 'phoneNumbers' },
}));

import { useContactsMatch, canPickContactsOnWeb } from '../src/hooks/useContactsMatch';
import { ContactsInviteSection } from '../src/components/ContactsInviteSection';

const mockMatchContacts = apiClient.matchContacts as jest.Mock;
const mockRecordConsent = apiClient.recordConsent as jest.Mock;

type NavigatorWithContacts = { contacts?: { select: jest.Mock } };
const nav = globalThis.navigator as unknown as NavigatorWithContacts;
const win = globalThis as unknown as { ContactsManager?: unknown };

function installPicker(select: jest.Mock) {
  nav.contacts = { select };
  win.ContactsManager = function ContactsManager() {};
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordConsent.mockResolvedValue(undefined);
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(() => {
  delete nav.contacts;
  delete win.ContactsManager;
  jest.restoreAllMocks();
});

describe('useContactsMatch on the web', () => {
  it('opens the browser contact picker, matches the chosen numbers and records consent', async () => {
    const select = jest.fn().mockResolvedValue([
      { name: ['Asha'], tel: ['98765 43210'] },
      { name: ['Ravi'], tel: ['+91 91234 56789', '+91 90000 00000'] },
      { name: ['No Number'], tel: [] },
    ]);
    installPicker(select);
    mockMatchContacts.mockResolvedValueOnce({
      results: [
        { phone_number: '98765 43210', player_id: 'p1', bfam_id: 'BF2001', full_name: null },
      ],
    });

    const { result } = await renderHook(() => useContactsMatch());
    expect(canPickContactsOnWeb()).toBe(true);
    await act(async () => {
      await result.current.load();
    });

    expect(select).toHaveBeenCalledWith(['name', 'tel'], { multiple: true });
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled(); // expo-contacts is never used on the web
    expect(mockMatchContacts).toHaveBeenCalledWith(['98765 43210', '+91 91234 56789']);
    expect(mockRecordConsent).toHaveBeenCalledWith('CONTACTS');
    expect(result.current.status).toBe('ready');
    expect(result.current.contacts.map((c) => [c.name, c.match?.player_id ?? null])).toEqual([
      ['Asha', 'p1'],
      ['Ravi', null],
    ]);
  });

  it('says so when the browser cannot read contacts (iPhone Safari, desktop)', async () => {
    const { result } = await renderHook(() => useContactsMatch());
    expect(canPickContactsOnWeb()).toBe(false);
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.status).toBe('unsupported');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('treats refusing the picker as "denied", not as an error', async () => {
    installPicker(
      jest.fn().mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' })),
    );
    const { result } = await renderHook(() => useContactsMatch());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.status).toBe('denied');
    expect(mockMatchContacts).not.toHaveBeenCalled();
  });

  it('finds a player by phone number, rejecting numbers that are too short', async () => {
    mockMatchContacts.mockResolvedValueOnce({
      results: [
        { phone_number: '9876543210', player_id: 'p9', bfam_id: 'BF2009', full_name: null },
      ],
    });
    const { result } = await renderHook(() => useContactsMatch());

    let problem: string | null = 'unset';
    await act(async () => {
      problem = await result.current.addByPhone('12345');
    });
    expect(problem).toMatch(/10-digit/);
    expect(mockMatchContacts).not.toHaveBeenCalled();

    await act(async () => {
      problem = await result.current.addByPhone('98765 43210');
    });
    expect(problem).toBeNull();
    expect(mockMatchContacts).toHaveBeenCalledWith(['9876543210']);
    expect(result.current.contacts[0].match?.player_id).toBe('p9');
    expect(result.current.contacts[0].name).toBe('BF2009'); // no full name on file -> BFAM ID, not the raw number
    expect(result.current.status).toBe('ready');
  });
});

describe('ContactsInviteSection on the web', () => {
  it('on an unsupported browser explains why and still lets you add a player by number', async () => {
    mockMatchContacts.mockResolvedValueOnce({
      results: [
        { phone_number: '9876543210', player_id: 'p9', bfam_id: 'BF2009', full_name: null },
      ],
    });
    const onInvite = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <ContactsInviteSection invitedIds={new Set()} busy={false} onInvite={onInvite} />,
    );

    await fireEvent.press(getByTestId('contacts-check-contacts-button'));
    expect(await findByTestId('contacts-contacts-unsupported')).toBeTruthy();

    await fireEvent.changeText(getByTestId('contacts-phone-input'), '9876543210');
    await fireEvent.press(getByTestId('contacts-phone-find-button'));

    const invite = await findByTestId('contacts-invite-button-p9');
    await fireEvent.press(invite);
    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith(expect.objectContaining({ player_id: 'p9' })),
    );
  });
});
