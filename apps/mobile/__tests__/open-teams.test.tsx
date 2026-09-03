import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getOpenTeams: jest.fn(), requestToJoinTeam: jest.fn() },
}));

const mockGetOpenTeams = apiClient.getOpenTeams as jest.Mock;
const mockRequestToJoinTeam = apiClient.requestToJoinTeam as jest.Mock;

import OpenTeamsScreen from '../app/(tabs)/teams/open';

const OPEN_TEAM = {
  team_id: 'team-1',
  team_name: 'Rajkot Strikers',
  team_logo_url: null,
  description: null,
  skill_level: 'INTERMEDIATE',
  home_city: 'Rajkot',
  is_open_for_players: true,
  team_status: 'ACTIVE',
  active_member_count: 4,
};

describe('OpenTeamsScreen (module 2.5)', () => {
  beforeEach(() => {
    mockGetOpenTeams.mockReset();
    mockRequestToJoinTeam.mockReset();
  });

  it('loads open teams on mount', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({ results: [OPEN_TEAM] });
    const { findByTestId } = render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(mockGetOpenTeams).toHaveBeenCalledWith({});
  });

  it('refetches on every focus, not just first mount, so a newly-open team appears without restarting the app', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [] });
    render(<OpenTeamsScreen />);
    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledTimes(1));

    // useFocusEffect's own useEffect re-runs on mount too in this RTL
    // setup (there's no real navigation focus/blur to simulate here), so
    // this mainly guards against a regression back to a plain mount-once
    // useEffect that would only ever call once, full stop.
    expect(mockGetOpenTeams).toHaveBeenCalledWith({});
  });

  it('sends a join request and marks the team as requested', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({ results: [OPEN_TEAM] });
    mockRequestToJoinTeam.mockResolvedValueOnce({ request_id: 'req-1' });

    const { findByTestId } = render(<OpenTeamsScreen />);
    fireEvent.press(await findByTestId('request-to-join-team-1'));

    await waitFor(() => expect(mockRequestToJoinTeam).toHaveBeenCalledWith('team-1'));
    const button = await findByTestId('request-to-join-team-1');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy();
  });

  it('re-fetches with the city filter when submitted', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [] });
    const { getByTestId } = render(<OpenTeamsScreen />);
    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledWith({}));

    fireEvent.changeText(getByTestId('open-teams-city-filter'), 'Rajkot');
    fireEvent(getByTestId('open-teams-city-filter'), 'submitEditing');

    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledWith({ city: 'Rajkot' }));
  });
});
