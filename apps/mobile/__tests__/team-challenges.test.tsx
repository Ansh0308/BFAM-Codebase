import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTeamDetails: jest.fn(),
    getJoinRequests: jest.fn(),
    inviteToTeam: jest.fn(),
    changeCaptain: jest.fn(),
    removeTeamMember: jest.fn(),
    respondToJoinRequest: jest.fn(),
    matchContacts: jest.fn(),
    getMyChallenges: jest.fn(),
    setOpenForChallenge: jest.fn(),
    respondToChallenge: jest.fn(),
    cancelChallenge: jest.fn(),
  },
}));

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getContactsAsync: jest.fn().mockResolvedValue({ data: [] }),
  Fields: { PhoneNumbers: 'phoneNumbers' },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ teamId: 'team-1' }),
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
}));

const mockGetTeamDetails = apiClient.getTeamDetails as jest.Mock;
const mockGetJoinRequests = apiClient.getJoinRequests as jest.Mock;
const mockGetMyChallenges = apiClient.getMyChallenges as jest.Mock;
const mockSetOpenForChallenge = apiClient.setOpenForChallenge as jest.Mock;
const mockRespondToChallenge = apiClient.respondToChallenge as jest.Mock;
const mockCancelChallenge = apiClient.cancelChallenge as jest.Mock;

import ManageTeamScreen from '../app/(tabs)/teams/[teamId]/manage';

const TEAM = {
  team_id: 'team-1',
  team_name: 'Rajkot Strikers',
  team_logo_url: null,
  description: null,
  skill_level: null,
  home_city: 'Rajkot',
  is_open_for_players: true,
  is_open_for_challenge: false,
  team_status: 'ACTIVE',
  created_by: 'captain-user',
  created_at: '',
  updated_at: '',
  members: [
    {
      team_member_id: 'tm-1',
      team_id: 'team-1',
      player_id: 'captain-player',
      role_in_team: 'CAPTAIN',
      membership_status: 'ACTIVE',
      joined_at: '',
      left_at: null,
      bfam_id: 'BF1000',
    },
  ],
};

// Backlog B-13: Team vs Team Challenge Mode, exercised from a team's
// Management screen — the toggle, and responding to/cancelling challenges.
describe('ManageTeamScreen — Team Challenges (backlog B-13)', () => {
  beforeEach(() => {
    mockGetTeamDetails.mockReset().mockResolvedValue(TEAM);
    mockGetJoinRequests.mockReset().mockResolvedValue({ results: [] });
    mockGetMyChallenges.mockReset().mockResolvedValue({ results: [] });
    mockSetOpenForChallenge.mockReset().mockResolvedValue({
      team_id: 'team-1',
      is_open_for_challenge: true,
    });
    mockRespondToChallenge.mockReset();
    mockCancelChallenge.mockReset();
  });

  it('toggles Open for Challenge', async () => {
    const { findByTestId } = await render(<ManageTeamScreen />);

    await fireEvent.press(await findByTestId('open-for-challenge-toggle-switch'));

    await waitFor(() => expect(mockSetOpenForChallenge).toHaveBeenCalledWith('team-1', true));
  });

  it('shows an incoming pending challenge with accept/decline actions', async () => {
    mockGetMyChallenges.mockResolvedValue({
      results: [
        {
          challenge_id: 'c-1',
          challenging_team_id: 'team-2',
          challenged_team_id: 'team-1',
          status: 'PENDING',
          initiated_by: 'u-2',
          responded_by: null,
          created_at: '',
          responded_at: null,
          challenging_team_name: 'Beta XI',
          challenged_team_name: 'Rajkot Strikers',
        },
      ],
    });

    const { findByText, findByTestId } = await render(<ManageTeamScreen />);

    await findByText('Challenge from Beta XI');
    expect(await findByTestId('accept-challenge-c-1')).toBeTruthy();
    expect(await findByTestId('decline-challenge-c-1')).toBeTruthy();
  });

  it('accepts an incoming challenge', async () => {
    mockGetMyChallenges.mockResolvedValue({
      results: [
        {
          challenge_id: 'c-1',
          challenging_team_id: 'team-2',
          challenged_team_id: 'team-1',
          status: 'PENDING',
          initiated_by: 'u-2',
          responded_by: null,
          created_at: '',
          responded_at: null,
          challenging_team_name: 'Beta XI',
          challenged_team_name: 'Rajkot Strikers',
        },
      ],
    });
    mockRespondToChallenge.mockResolvedValueOnce({ status: 'ACCEPTED' });

    const { findByTestId } = await render(<ManageTeamScreen />);
    await fireEvent.press(await findByTestId('accept-challenge-c-1'));

    await waitFor(() => expect(mockRespondToChallenge).toHaveBeenCalledWith('c-1', true));
  });

  it('lets the challenger cancel an outgoing pending challenge', async () => {
    mockGetMyChallenges.mockResolvedValue({
      results: [
        {
          challenge_id: 'c-2',
          challenging_team_id: 'team-1',
          challenged_team_id: 'team-3',
          status: 'PENDING',
          initiated_by: 'captain-user',
          responded_by: null,
          created_at: '',
          responded_at: null,
          challenging_team_name: 'Rajkot Strikers',
          challenged_team_name: 'Gamma XI',
        },
      ],
    });
    mockCancelChallenge.mockResolvedValueOnce({ status: 'CANCELLED' });

    const { findByText, findByTestId } = await render(<ManageTeamScreen />);

    await findByText('Challenged Gamma XI');
    await fireEvent.press(await findByTestId('cancel-challenge-c-2'));

    await waitFor(() => expect(mockCancelChallenge).toHaveBeenCalledWith('c-2'));
  });

  it('shows a Create Match action for an accepted challenge', async () => {
    mockGetMyChallenges.mockResolvedValue({
      results: [
        {
          challenge_id: 'c-3',
          challenging_team_id: 'team-1',
          challenged_team_id: 'team-4',
          status: 'ACCEPTED',
          initiated_by: 'captain-user',
          responded_by: 'u-4',
          created_at: '',
          responded_at: '',
          challenging_team_name: 'Rajkot Strikers',
          challenged_team_name: 'Delta XI',
        },
      ],
    });

    const { findByTestId } = await render(<ManageTeamScreen />);

    await fireEvent.press(await findByTestId('create-match-from-challenge-c-3'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/create');
  });
});
