import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(cb, []);
  },
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTeams: jest.fn(),
    getMyProfile: jest.fn().mockResolvedValue({ coin_balance: 0 }),
    getNotifications: jest.fn().mockResolvedValue({ results: [] }),
  },
}));

const mockGetMyTeams = apiClient.getMyTeams as jest.Mock;

import MyTeamsScreen from '../app/(tabs)/teams/index';

const TEAM = {
  team_id: 'team-1',
  team_name: 'BFAM Team A',
  team_logo_url: null,
  description: null,
  skill_level: null,
  home_city: 'Rajkot',
  is_open_for_players: false,
  team_status: 'ACTIVE',
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  role_in_team: 'CAPTAIN',
  member_count: 8,
  matches_played: 12,
  wins: 7,
  losses: 5,
};

describe('My Teams screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the team count and each team’s members, matches and win-loss', async () => {
    mockGetMyTeams.mockResolvedValue({ results: [TEAM] });
    const { findByTestId, findByText } = await render(<MyTeamsScreen />);

    await findByTestId('my-team-row-team-1');
    expect(await findByText('1 Team')).toBeTruthy();
    expect(await findByText('7 - 5')).toBeTruthy();
    expect(await findByText('12')).toBeTruthy();
    expect(await findByText('8')).toBeTruthy();
  });

  it('opens a team and routes the two primary actions', async () => {
    mockGetMyTeams.mockResolvedValue({ results: [TEAM] });
    const { findByTestId, getByTestId } = await render(<MyTeamsScreen />);

    await fireEvent.press(await findByTestId('my-team-row-team-1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/teams/team-1');

    await fireEvent.press(getByTestId('create-team-button'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/teams/create');
    await fireEvent.press(getByTestId('find-open-teams-button'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/teams/open');
  });

  it('shows the empty state with a Create Team action when there are no teams', async () => {
    mockGetMyTeams.mockResolvedValue({ results: [] });
    const { findByTestId } = await render(<MyTeamsScreen />);

    await findByTestId('my-teams-empty');
    await fireEvent.press(await findByTestId('my-teams-empty-create'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/teams/create');
  });
});
