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
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ teamId: 'team-1' }),
}));

// useFocusEffect normally needs a real NavigationContainer (which expo-router
// provides at runtime); this test renders the screen standalone, so swap it
// for a plain mount-time effect.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    // A plain top-level `import React` can't be referenced here — Jest's
    // hoisting only allows `mock`-prefixed out-of-scope variables inside a
    // jest.mock() factory, so this needs its own require() call.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
}));

const mockGetTeamDetails = apiClient.getTeamDetails as jest.Mock;
const mockGetJoinRequests = apiClient.getJoinRequests as jest.Mock;
const mockInviteToTeam = apiClient.inviteToTeam as jest.Mock;
const mockChangeCaptain = apiClient.changeCaptain as jest.Mock;

import ManageTeamScreen from '../app/(tabs)/teams/[teamId]/manage';

const TEAM = {
  team_id: 'team-1',
  team_name: 'Rajkot Strikers',
  team_logo_url: null,
  description: null,
  skill_level: null,
  home_city: 'Rajkot',
  is_open_for_players: true,
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
    {
      team_member_id: 'tm-2',
      team_id: 'team-1',
      player_id: 'member-player',
      role_in_team: 'MEMBER',
      membership_status: 'ACTIVE',
      joined_at: '',
      left_at: null,
      bfam_id: 'BF1001',
    },
  ],
};

describe('ManageTeamScreen (module 2.5)', () => {
  beforeEach(() => {
    mockGetTeamDetails.mockReset().mockResolvedValue(TEAM);
    mockGetJoinRequests.mockReset().mockResolvedValue({ results: [] });
    mockInviteToTeam.mockReset();
    mockChangeCaptain.mockReset();
  });

  it('sends an invite with the entered player id', async () => {
    mockInviteToTeam.mockResolvedValueOnce({ invitation_id: 'inv-1' });
    const { findByTestId } = render(<ManageTeamScreen />);

    fireEvent.changeText(await findByTestId('invite-player-id-input'), 'new-player-id');
    fireEvent.press(await findByTestId('send-invite-button'));

    await waitFor(() => expect(mockInviteToTeam).toHaveBeenCalledWith('team-1', 'new-player-id'));
  });

  it('never shows a "make captain" or "remove" action for the current captain', async () => {
    const { findByTestId, queryByTestId } = render(<ManageTeamScreen />);
    await findByTestId('manage-member-captain-player');

    expect(queryByTestId('make-captain-captain-player')).toBeNull();
    expect(queryByTestId('remove-member-captain-player')).toBeNull();
    expect(await findByTestId('make-captain-member-player')).toBeTruthy();
  });

  it('changes the captain when "Make Captain" is pressed for another member', async () => {
    mockChangeCaptain.mockResolvedValueOnce(undefined);
    const { findByTestId } = render(<ManageTeamScreen />);

    fireEvent.press(await findByTestId('make-captain-member-player'));

    await waitFor(() => expect(mockChangeCaptain).toHaveBeenCalledWith('team-1', 'member-player'));
  });
});
