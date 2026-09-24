import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getLeaderboard: jest.fn() },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockGetLeaderboard = apiClient.getLeaderboard as jest.Mock;

import LeaderboardsScreen from '../app/leaderboards';

const RUNS_RESULTS = {
  category: 'MOST_RUNS',
  results: [
    { rank: 1, player_id: 'p1', bfam_id: 'BF1001', full_name: 'Asha Patel', value: 320 },
    { rank: 2, player_id: 'p2', bfam_id: 'BF1002', full_name: 'Rohan Mehta', value: 280 },
  ],
};

// Long tail — Rankings & Leaderboards (PRD §12.33).
describe('LeaderboardsScreen (long tail — Rankings & Leaderboards)', () => {
  beforeEach(() => {
    mockGetLeaderboard.mockReset();
    mockBack.mockReset();
  });

  it('loads and shows the default MOST_RUNS leaderboard, ranked and with names', async () => {
    mockGetLeaderboard.mockResolvedValueOnce(RUNS_RESULTS);

    const { findByTestId } = await render(<LeaderboardsScreen />);

    expect(await findByTestId('leaderboard-row-p1')).toBeTruthy();
    await waitFor(() => expect(mockGetLeaderboard).toHaveBeenCalledWith('MOST_RUNS'));
  });

  it('switches category on tap and refetches', async () => {
    mockGetLeaderboard.mockResolvedValueOnce(RUNS_RESULTS).mockResolvedValueOnce({
      category: 'MOST_WICKETS',
      results: [
        { rank: 1, player_id: 'p2', bfam_id: 'BF1002', full_name: 'Rohan Mehta', value: 12 },
      ],
    });

    const { findByTestId } = await render(<LeaderboardsScreen />);
    await findByTestId('leaderboard-row-p1');

    await fireEvent.press(await findByTestId('leaderboard-category-MOST_WICKETS'));

    await waitFor(() => expect(mockGetLeaderboard).toHaveBeenCalledWith('MOST_WICKETS'));
    expect(await findByTestId('leaderboard-row-p2')).toBeTruthy();
  });

  it('shows an empty state when no players qualify', async () => {
    mockGetLeaderboard.mockResolvedValueOnce({ category: 'BEST_ECONOMY', results: [] });

    const { findByTestId } = await render(<LeaderboardsScreen />);

    expect(await findByTestId('leaderboards-empty')).toBeTruthy();
  });

  it('shows an error message when the load fails', async () => {
    mockGetLeaderboard.mockRejectedValueOnce(new Error('network down'));

    const { findByText } = await render(<LeaderboardsScreen />);

    expect(await findByText(/could not load the leaderboard/i)).toBeTruthy();
  });

  it('navigates back on the back button', async () => {
    mockGetLeaderboard.mockResolvedValueOnce(RUNS_RESULTS);

    const { findByTestId } = await render(<LeaderboardsScreen />);
    await fireEvent.press(await findByTestId('leaderboards-back'));

    expect(mockBack).toHaveBeenCalled();
  });
});
