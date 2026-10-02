import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getOpenTeams: jest.fn(),
    requestToJoinTeam: jest.fn(),
    getMyTeams: jest.fn(),
    sendChallenge: jest.fn(),
  },
}));

// useFocusEffect (from expo-router, which implements it natively rather
// than via react-navigation as of SDK 57) needs the real router context this
// standalone test doesn't set up, so swap it for a plain mount-time effect —
// same pattern as team-management.test.tsx.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // The real useFocusEffect re-runs whenever the memoized callback passed to
  // it changes identity, not just on mount — the screen relies on that to
  // refetch when `mode`/`city` change (no explicit "search" button). The
  // screen already wraps its callback in `useCallback(..., [load, mode,
  // city])`, so depending on `callback` itself here reproduces that: it
  // only re-runs when mode/city actually change, not on every render (an
  // empty `[]` would miss those changes; no deps array at all would loop,
  // since the callback sets state that re-renders the component).
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
}));

const mockGetOpenTeams = apiClient.getOpenTeams as jest.Mock;
const mockRequestToJoinTeam = apiClient.requestToJoinTeam as jest.Mock;
const mockGetMyTeams = apiClient.getMyTeams as jest.Mock;

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
    mockGetMyTeams.mockReset();
    mockGetMyTeams.mockResolvedValue({ results: [] });
  });

  it('loads open teams on mount', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [OPEN_TEAM] });
    const { findByTestId } = await render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(mockGetOpenTeams).toHaveBeenCalledWith({ mode: 'players' });
  });

  // Backlog B-5: Fair Play score shown per team so players can factor it
  // into which open team they request to join.
  it('shows the Fair Play score badge when the team has one', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [OPEN_TEAM] });
    const { findByTestId } = await render(<OpenTeamsScreen />);

    const badge = await findByTestId('fair-play-score-team-1');
    expect(badge).toBeTruthy();
  });

  it('hides the Fair Play badge for a team with no active members yet', async () => {
    mockGetOpenTeams.mockResolvedValue({
      results: [{ ...OPEN_TEAM, fair_play_score: null }],
    });
    const { findByTestId, queryByTestId } = await render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(queryByTestId('fair-play-score-team-1')).toBeNull();
  });

  // Backlog B-8: rating-gated team vacancies.
  it('shows the minimum skill rating requirement when the team has one', async () => {
    mockGetOpenTeams.mockResolvedValue({
      results: [{ ...OPEN_TEAM, min_skill_rating: 600 }],
    });
    const { findByText } = await render(<OpenTeamsScreen />);

    await findByText(/requires 600\+ skill rating/i);
  });

  it('hides the requirement line for a team with no minimum', async () => {
    mockGetOpenTeams.mockResolvedValue({
      results: [{ ...OPEN_TEAM, min_skill_rating: null }],
    });
    const { findByTestId, queryByTestId } = await render(<OpenTeamsScreen />);

    await findByTestId('open-team-row-team-1');
    expect(queryByTestId('min-skill-rating-team-1')).toBeNull();
  });

  it('surfaces the backend rejection when the player is below the minimum', async () => {
    mockGetOpenTeams.mockResolvedValue({
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

    // useFocusEffect's own useEffect re-runs on mount too in this RTL
    // setup (there's no real navigation focus/blur to simulate here), so
    // this mainly guards against a regression back to a plain mount-once
    // useEffect that would only ever call once, full stop. (The screen
    // also makes a second, separate getOpenTeams call on mount to
    // populate the city filter's own option list.)
    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledWith({ mode: 'players' }));
  });

  it('sends a join request and marks the team as requested', async () => {
    mockGetOpenTeams.mockResolvedValue({ results: [OPEN_TEAM] });
    mockRequestToJoinTeam.mockResolvedValueOnce({ request_id: 'req-1' });

    const { findByTestId } = await render(<OpenTeamsScreen />);
    await fireEvent.press(await findByTestId('request-to-join-team-1'));

    await waitFor(() => expect(mockRequestToJoinTeam).toHaveBeenCalledWith('team-1'));
    const button = await findByTestId('request-to-join-team-1');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy();
  });

  it('re-fetches with the city filter once a city is picked', async () => {
    // Also backs the city picker's own option list (a separate,
    // unfiltered-by-city fetch for the current mode).
    mockGetOpenTeams.mockResolvedValue({ results: [OPEN_TEAM] });
    const { getByTestId, findByTestId } = await render(<OpenTeamsScreen />);
    await waitFor(() => expect(mockGetOpenTeams).toHaveBeenCalledWith({ mode: 'players' }));

    await fireEvent.press(getByTestId('open-teams-city-filter-trigger'));
    await fireEvent.press(await findByTestId('open-teams-city-filter-option-Rajkot'));

    await waitFor(() =>
      expect(mockGetOpenTeams).toHaveBeenCalledWith({ mode: 'players', city: 'Rajkot' }),
    );
  });
});
