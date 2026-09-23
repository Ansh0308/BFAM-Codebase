import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTeams: jest.fn(),
    getTeamDetails: jest.fn(),
    inviteToMatch: jest.fn(),
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

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
}));

const mockGetMyTeams = apiClient.getMyTeams as jest.Mock;
const mockInviteToMatch = apiClient.inviteToMatch as jest.Mock;
const mockMatchContacts = apiClient.matchContacts as jest.Mock;
const mockRecordConsent = apiClient.recordConsent as jest.Mock;

import InvitePlayersScreen from '../app/(tabs)/matches/[matchId]/invite';

// Backlog B-2: contacts-based invites, re-surfaced here for Match invites
// alongside the existing BFAM ID / share-link / WhatsApp paths.
describe('Invite Players screen — inviting from contacts (backlog B-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyTeams.mockResolvedValue({ results: [] });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetContactsAsync.mockResolvedValue({ data: [] });
  });

  it('checks contacts, shows matched players, and invites by player_id', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [{ phoneNumbers: [{ number: '+919876543210' }] }],
    });
    mockMatchContacts.mockResolvedValueOnce({
      results: [
        {
          phone_number: '+919876543210',
          player_id: 'p-contact-1',
          bfam_id: 'BF2001',
          full_name: null,
        },
      ],
    });
    mockInviteToMatch.mockResolvedValueOnce({ invitation_id: 'inv-1' });

    const { findByTestId } = await render(<InvitePlayersScreen />);
    await fireEvent.press(await findByTestId('match-invite-check-contacts-button'));

    expect(await findByTestId('match-invite-contact-row-p-contact-1')).toBeTruthy();
    await fireEvent.press(await findByTestId('match-invite-invite-button-p-contact-1'));

    await waitFor(() => expect(mockInviteToMatch).toHaveBeenCalledWith('match-1', 'p-contact-1'));
  });

  // Backlog G-21: a versioned consent record should be logged the moment
  // Contacts access is actually granted, not just at signup.
  it('records a CONTACTS consent once permission is granted', async () => {
    const { findByTestId } = await render(<InvitePlayersScreen />);
    await fireEvent.press(await findByTestId('match-invite-check-contacts-button'));

    await waitFor(() => expect(mockRecordConsent).toHaveBeenCalledWith('CONTACTS'));
  });

  it('does not record a consent when permission is denied', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const { findByTestId } = await render(<InvitePlayersScreen />);
    await fireEvent.press(await findByTestId('match-invite-check-contacts-button'));

    await findByTestId('match-invite-contacts-denied');
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });

  it('only ever sends phone numbers to the lookup, never names or other contact fields', async () => {
    mockGetContactsAsync.mockResolvedValue({
      data: [
        { name: 'Jane Doe', phoneNumbers: [{ number: '+919876543210' }] },
        { name: 'No Phone', phoneNumbers: [] },
      ],
    });
    mockMatchContacts.mockResolvedValueOnce({ results: [] });

    const { findByTestId } = await render(<InvitePlayersScreen />);
    await fireEvent.press(await findByTestId('match-invite-check-contacts-button'));

    await waitFor(() => expect(mockMatchContacts).toHaveBeenCalledWith(['+919876543210']));
  });
});
