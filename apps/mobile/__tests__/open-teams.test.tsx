import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getOpenTeams: jest.fn(), requestToJoinTeam: jest.fn() },
}));

// useFocusEffect (from expo-router, which implements it natively rather
// than via react-navigation as of SDK 57) needs the real router context this
// standalone test doesn't set up, so swap it for a plain mount-time effect —
// same pattern as team-management.test.tsx.
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
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
  fair_play_score: 88,
};

describe('OpenTeamsScreen (module 2.5)', () => {
  beforeEach(() => {
    mockGetOpenTeams.mockReset();
    mockRequestToJoinTeam.mockReset();
  });

  it('loads open teams on mount', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({ results: [OPEN_TEAM] });
    const { findByTestId } = await render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(mockGetOpenTeams).toHaveBeenCalledWith({});
  });

  // Backlog B-5: Fair Play score shown per team so players can factor it
  // into which open team they request to join.
  it('shows the Fair Play score badge when the team has one', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({ results: [OPEN_TEAM] });
    const { findByTestId } = await render(<OpenTeamsScreen />);

    const badge = await findByTestId('fair-play-score-team-1');
    expect(badge).toBeTruthy();
  });

  it('hides the Fair Play badge for a team with no active members yet', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({
      results: [{ ...OPEN_TEAM, fair_play_score: null }],
    });
    const { findByTestId, queryByTestId } = await render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(queryByTestId('fair-play-score-team-1')).toBeNull();
  });

  // Backlog B-8: rating-gated team vacancies.
  it('shows the minimum skill rating requirement when the team has one', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({
      results: [{ ...OPEN_TEAM, min_skill_rating: 600 }],
    });
    const { findByText } = await render(<OpenTeamsScreen />);

    await findByText(/requires 600\+ skill rating/i);
  });

  it('hides the requirement line for a team with no minimum', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({
      results: [{ ...OPEN_TEAM, min_skill_rating: null }],
    });
    const { findByTestId, queryByTestId } = await render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(queryByTestId('min-skill-rating-team-1')).toBeNull();
  });

  it('surfaces the backend rejection when the player is below the minimum', async () => {
    mockGetOpenTeams.mockResolvedValueOnce({
      results: [{ ...OPEN_TEAM, min_skill_rating: 600 }],
    });
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    mockRequestToJoinTeam.mockRejectedValueOnce(
      new BFAMApiError('This team requires a Basic Skill Rating of at least 600 to join.', 409),
    );

    const { findByTestId, findByText } = await render(<OpenTeamsScreen />);
    await fireEvent.press(await findByTestId('request-to-join-team-1'));

    await findByText(/requires a basic skill rating of at least 600/i);
  });

  it('refetches on every focus, not just first mount, so a newly-open team appears without restarting the app', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [] });
    await render(<OpenTeamsScreen />);
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

    const { findByTestId } = await render(<OpenTeamsScreen />);
    await fireEvent.press(await findByTestId('request-to-join-team-1'));

    await waitFor(() => expect(mockRequestToJoinTeam).toHaveBeenCalledWith('team-1'));
    const button = await findByTestId('request-to-join-team-1');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy();
  });

  it('re-fetches with the city filter when submitted', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [] });
    const { getByTestId } = await render(<OpenTeamsScreen />);
    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledWith({}));

    await fireEvent.changeText(getByTestId('open-teams-city-filter'), 'Rajkot');
    fireEvent(getByTestId('open-teams-city-filter'), 'submitEditing');

    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledWith({ city: 'Rajkot' }));
  });
});
