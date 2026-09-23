import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTeamDetails: jest.fn(),
    getMyTeams: jest.fn(),
    sendChallenge: jest.fn(),
    leaveTeam: jest.fn(),
  },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ teamId: 'team-a' }),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
}));

let mockCurrentUserBfamId = 'BF1002';
jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { bfam_id: string } }) => unknown) =>
    selector({ user: { bfam_id: mockCurrentUserBfamId } }),
}));

const mockGetTeamDetails = apiClient.getTeamDetails as jest.Mock;
const mockGetMyTeams = apiClient.getMyTeams as jest.Mock;
const mockLeaveTeam = apiClient.leaveTeam as jest.Mock;

import TeamDetailsScreen from '../app/(tabs)/teams/[teamId]/index';

const TEAM = {
  team_id: 'team-a',
  team_name: 'Rajkot Strikers',
  team_logo_url: null,
  description: null,
  skill_level: null,
  home_city: 'Rajkot',
  is_open_for_players: false,
  is_open_for_challenge: false,
  team_status: 'ACTIVE',
  created_by: 'captain-user',
  created_at: '',
  updated_at: '',
  members: [
    {
      team_member_id: 'tm-1',
      team_id: 'team-a',
      player_id: 'captain-player',
      role_in_team: 'CAPTAIN',
      membership_status: 'ACTIVE',
      joined_at: '',
      left_at: null,
      bfam_id: 'BF1001',
    },
    {
      team_member_id: 'tm-2',
      team_id: 'team-a',
      player_id: 'member-player',
      role_in_team: 'MEMBER',
      membership_status: 'ACTIVE',
      joined_at: '',
      left_at: null,
      bfam_id: 'BF1002',
    },
  ],
};

// Backlog A-16: a real Leave Team button — the backend endpoint has
// existed, unused by the mobile app, since before v2 was even written.
describe('Team Details — Leave Team (backlog A-16)', () => {
  beforeEach(() => {
    mockCurrentUserBfamId = 'BF1002';
    mockGetTeamDetails.mockReset().mockResolvedValue(TEAM);
    mockGetMyTeams.mockReset().mockResolvedValue({ results: [] });
    mockLeaveTeam.mockReset();
    mockReplace.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a Leave Team button for an active non-captain member', async () => {
    const { findByTestId } = await render(<TeamDetailsScreen />);

    expect(await findByTestId('leave-team-button')).toBeTruthy();
  });

  it('does not show a Leave Team button for the captain', async () => {
    mockCurrentUserBfamId = 'BF1001'; // the captain's own bfam_id in TEAM's fixture.

    const { findByTestId, queryByTestId } = await render(<TeamDetailsScreen />);
    await findByTestId('manage-team-button'); // confirms the captain view rendered.

    expect(queryByTestId('leave-team-button')).toBeNull();
  });

  it('confirms before leaving, then calls the API and navigates to My Teams', async () => {
    mockLeaveTeam.mockResolvedValueOnce(undefined);
    const { findByTestId } = await render(<TeamDetailsScreen />);

    await fireEvent.press(await findByTestId('leave-team-button'));

    await waitFor(() => expect(mockLeaveTeam).toHaveBeenCalledWith('team-a'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/teams'));
  });

  it('shows the backend error (e.g. captain-transfer-first) instead of silently failing', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    mockLeaveTeam.mockRejectedValueOnce(
      new BFAMApiError('The captain cannot leave — transfer captaincy to someone else first.', 409),
    );

    const { findByTestId, findByText } = await render(<TeamDetailsScreen />);
    await fireEvent.press(await findByTestId('leave-team-button'));

    expect(await findByText(/transfer captaincy/i)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
