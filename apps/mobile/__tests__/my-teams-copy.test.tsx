import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(cb, []);
  },
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTeams: jest.fn(),
  },
}));

const mockGetMyTeams = apiClient.getMyTeams as jest.Mock;

import MyTeamsScreen from '../app/(tabs)/teams/index';

const TEAM = {
  team_id: 'team-1',
  team_name: 'Rajkot Strikers',
  team_logo_url: null,
  description: 'The original squad',
  skill_level: 'ADVANCED',
  home_city: 'Rajkot',
  is_open_for_players: false,
  team_status: 'ACTIVE',
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  role_in_team: 'CAPTAIN',
};

// Backlog A-11: the copy affordance on each My Teams row should hand every
// relevant field of that team to Create Team via query params, so the
// organizer doesn't have to retype anything to start a similar team.
describe('My Teams — copy an existing team (backlog A-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyTeams.mockResolvedValue({ results: [TEAM] });
  });

  it('navigates to Create Team with the team fields as copyFrom params', async () => {
    const { findByTestId } = await render(<MyTeamsScreen />);

    const copyButton = await findByTestId('copy-team-team-1');
    await fireEvent.press(copyButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/teams/create',
        params: {
          copyFromTeamName: 'Rajkot Strikers',
          copyFromDescription: 'The original squad',
          copyFromHomeCity: 'Rajkot',
          copyFromSkillLevel: 'ADVANCED',
          copyFromIsOpen: 'false',
        },
      });
    });
  });
});
