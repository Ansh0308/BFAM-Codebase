import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { searchPlayers: jest.fn() },
}));

const mockSearchPlayers = apiClient.searchPlayers as jest.Mock;

import PlayerSearchScreen from '../app/player-search';

// Backlog B-12: Player Search from the Home top nav.
describe('Player Search screen (backlog B-12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('searches after a debounce and lists results by name, BFAM ID, role, and city', async () => {
    mockSearchPlayers.mockResolvedValue({
      results: [
        {
          player_id: 'p1',
          bfam_id: 'BF1001',
          full_name: 'Rohan Mehta',
          profile_photo_url: null,
          city: 'Rajkot',
          playing_role: 'BATTER',
        },
      ],
    });

    const { getByTestId, findByText } = await render(<PlayerSearchScreen />);
    fireEvent.changeText(getByTestId('player-search-input'), 'roh');

    expect(mockSearchPlayers).not.toHaveBeenCalled();

    await waitFor(() => jest.advanceTimersByTime(350));

    await waitFor(() => expect(mockSearchPlayers).toHaveBeenCalledWith('roh'));
    expect(await findByText('Rohan Mehta')).toBeTruthy();
    expect(await findByText('BF1001 · Batter · Rajkot')).toBeTruthy();
  });

  it('navigates to the player profile when a result is tapped', async () => {
    mockSearchPlayers.mockResolvedValue({
      results: [
        {
          player_id: 'p1',
          bfam_id: 'BF1001',
          full_name: 'Rohan Mehta',
          profile_photo_url: null,
          city: null,
          playing_role: null,
        },
      ],
    });

    const { getByTestId } = await render(<PlayerSearchScreen />);
    fireEvent.changeText(getByTestId('player-search-input'), 'roh');
    await waitFor(() => jest.advanceTimersByTime(350));
    await waitFor(() => expect(getByTestId('player-search-result-p1')).toBeTruthy());

    await fireEvent.press(getByTestId('player-search-result-p1'));

    expect(mockPush).toHaveBeenCalledWith('/player-profile?playerId=p1');
  });

  it('shows an empty-state message when nothing matches', async () => {
    mockSearchPlayers.mockResolvedValue({ results: [] });

    const { getByTestId, findByTestId } = await render(<PlayerSearchScreen />);
    fireEvent.changeText(getByTestId('player-search-input'), 'zzz');
    await waitFor(() => jest.advanceTimersByTime(350));

    expect(await findByTestId('player-search-empty')).toBeTruthy();
  });

  it('never calls the API for a blank query', async () => {
    const { getByTestId } = await render(<PlayerSearchScreen />);
    fireEvent.changeText(getByTestId('player-search-input'), '  ');
    await waitFor(() => jest.advanceTimersByTime(350));

    expect(mockSearchPlayers).not.toHaveBeenCalled();
  });
});
