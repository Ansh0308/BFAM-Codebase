import React from 'react';
import { render } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getLiveScore: jest.fn(),
    getGameRoom: jest.fn(),
    getViewerCount: jest.fn().mockResolvedValue({ active: 0, total: 0 }),
  },
}));

jest.mock('../src/lib/socket', () => ({
  getSocket: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn() }),
  joinMatchRoom: jest.fn(),
  leaveMatchRoom: jest.fn(),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string } | null }) => unknown) =>
    selector({ user: { user_id: 'organizer-user' } }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
}));

const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;
const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;

import LiveScoreScreen from '../app/(tabs)/matches/[matchId]/live';

const ROOM = {
  match_id: 'match-1',
  match_name: 'Sunday Evening Bash',
  match_status: 'OPEN',
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  players: [
    { player_id: 'p1', bfam_id: 'BFDEMO34486101', full_name: 'Aditya Shah' },
    { player_id: 'p2', bfam_id: 'BFDEMO34486104', full_name: null },
    { player_id: 'p3', bfam_id: 'BFDEMO34486100', full_name: 'Rohan Mehta' },
  ],
};

const LIVE = {
  match_id: 'match-1',
  innings: {
    innings_id: 'innings-1',
    total_runs: 41,
    total_wickets: 2,
    overs_completed: 2.3,
    target_runs: null,
  },
  current_striker_player_id: 'p1',
  current_non_striker_player_id: 'p2',
  current_bowler_player_id: 'p3',
  current_run_rate: 17.4,
  required_run_rate: null,
};

// Backlog A-18: name-instead-of-BFAM-ID. A crowd watching Live Score has
// no idea whose BFAM ID "BFDEMO34486101" is — found live while checking
// the exact screen a user screenshotted showing raw IDs for
// striker/non-striker/bowler.
describe('Live Score screen (backlog A-18)', () => {
  beforeEach(() => {
    mockGetLiveScore.mockReset().mockResolvedValue(LIVE);
    mockGetGameRoom.mockReset().mockResolvedValue(ROOM);
  });

  it('shows player names for striker, non-striker, and bowler, not raw BFAM IDs', async () => {
    const { findByText, queryByText } = await render(<LiveScoreScreen />);

    expect(await findByText('Aditya Shah')).toBeTruthy();
    expect(await findByText('Rohan Mehta')).toBeTruthy();
    expect(queryByText('BFDEMO34486101')).toBeNull();
    expect(queryByText('BFDEMO34486100')).toBeNull();
  });

  it('falls back to the BFAM ID for a player with no full_name set', async () => {
    const { findByText } = await render(<LiveScoreScreen />);

    expect(await findByText('BFDEMO34486104')).toBeTruthy();
  });
});
