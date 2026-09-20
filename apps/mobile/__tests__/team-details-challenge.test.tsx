import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTeamDetails: jest.fn(),
    getMyTeams: jest.fn(),
    sendChallenge: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ teamId: 'team-b' }),
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { bfam_id: string } }) => unknown) =>
    selector({ user: { bfam_id: 'BF9999' } }),
}));

const mockGetTeamDetails = apiClient.getTeamDetails as jest.Mock;
const mockGetMyTeams = apiClient.getMyTeams as jest.Mock;
const mockSendChallenge = apiClient.sendChallenge as jest.Mock;

import TeamDetailsScreen from '../app/(tabs)/teams/[teamId]/index';

const TEAM_B = {
  team_id: 'team-b',
  team_name: 'Beta XI',
  team_logo_url: null,
  description: null,
  skill_level: null,
  home_city: 'Rajkot',
  is_open_for_players: false,
  is_open_for_challenge: true,
  team_status: 'ACTIVE',
  created_by: 'other-user',
  created_at: '',
  updated_at: '',
  members: [
    {
      team_member_id: 'tm-1',
      team_id: 'team-b',
      player_id: 'other-player',
      role_in_team: 'CAPTAIN',
      membership_status: 'ACTIVE',
      joined_at: '',
      left_at: null,
      bfam_id: 'BF2000',
    },
  ],
};

// Backlog B-13: viewing a team that is not mine and is open for
// challenges shows a "Challenge This Team" action, using whichever team(s)
// I captain myself.
describe('TeamDetailsScreen — Challenge This Team (backlog B-13)', () => {
  beforeEach(() => {
    mockGetTeamDetails.mockReset().mockResolvedValue(TEAM_B);
    mockGetMyTeams.mockReset();
    mockSendChallenge.mockReset();
  });

  it('shows a challenge button when I captain a team and the viewed team is open for challenges', async () => {
    mockGetMyTeams.mockResolvedValueOnce({
      results: [{ team_id: 'team-a', team_name: 'Alpha XI', role_in_team: 'CAPTAIN' }],
    });

    const { findByTestId } = await render(<TeamDetailsScreen />);

    expect(await findByTestId('challenge-this-team-team-a')).toBeTruthy();
  });

  it('sends a challenge and shows it as sent', async () => {
    mockGetMyTeams.mockResolvedValueOnce({
      results: [{ team_id: 'team-a', team_name: 'Alpha XI', role_in_team: 'CAPTAIN' }],
    });
    mockSendChallenge.mockResolvedValueOnce({ challenge_id: 'c-1' });

    const { findByTestId, findByText } = await render(<TeamDetailsScreen />);
    await fireEvent.press(await findByTestId('challenge-this-team-team-a'));

    await waitFor(() => expect(mockSendChallenge).toHaveBeenCalledWith('team-a', 'team-b'));
    await findByText(/challenge sent/i);
  });

  it('hides the challenge section when I do not captain any team', async () => {
    mockGetMyTeams.mockResolvedValueOnce({ results: [] });

    const { findByTestId, queryByTestId } = await render(<TeamDetailsScreen />);
    await findByTestId('team-details-screen');

    expect(queryByTestId('challenge-team-section')).toBeNull();
  });

  it('hides the challenge section when the viewed team is not open for challenges', async () => {
    mockGetTeamDetails.mockResolvedValueOnce({ ...TEAM_B, is_open_for_challenge: false });
    mockGetMyTeams.mockResolvedValueOnce({
      results: [{ team_id: 'team-a', team_name: 'Alpha XI', role_in_team: 'CAPTAIN' }],
    });

    const { findByTestId, queryByTestId } = await render(<TeamDetailsScreen />);
    await findByTestId('team-details-screen');

    expect(queryByTestId('challenge-team-section')).toBeNull();
  });
});
