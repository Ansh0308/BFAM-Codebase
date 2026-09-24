import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getPlayerMatchStreaks: jest.fn() },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockGetPlayerMatchStreaks = apiClient.getPlayerMatchStreaks as jest.Mock;

import MatchStreaksScreen from '../app/match-streaks';

// Long tail — Match Streaks (PRD §12.38).
describe('MatchStreaksScreen (long tail — Match Streaks)', () => {
  beforeEach(() => {
    mockGetPlayerMatchStreaks.mockReset();
    mockBack.mockReset();
  });

  it('shows the current and best streak values', async () => {
    mockGetPlayerMatchStreaks.mockResolvedValueOnce({
      current_streak: 3,
      best_streak: 5,
      participated_week_starts: ['2026-09-01', '2026-09-08', '2026-09-15'],
    });

    const { findByTestId } = await render(<MatchStreaksScreen />);

    expect((await findByTestId('current-streak-value')).props.children).toBe(3);
    expect((await findByTestId('best-streak-value')).props.children).toBe(5);
  });

  it('shows an encouragement message when the current streak is 0', async () => {
    mockGetPlayerMatchStreaks.mockResolvedValueOnce({
      current_streak: 0,
      best_streak: 2,
      participated_week_starts: [],
    });

    const { findByTestId } = await render(<MatchStreaksScreen />);

    expect(await findByTestId('match-streaks-encouragement')).toBeTruthy();
  });

  it('shows an error message when loading fails', async () => {
    mockGetPlayerMatchStreaks.mockRejectedValueOnce(new Error('network down'));

    const { findByText } = await render(<MatchStreaksScreen />);

    expect(await findByText(/could not load your match streaks/i)).toBeTruthy();
  });

  it('navigates back on the back button', async () => {
    mockGetPlayerMatchStreaks.mockResolvedValueOnce({
      current_streak: 1,
      best_streak: 1,
      participated_week_starts: ['2026-09-15'],
    });

    const { findByTestId } = await render(<MatchStreaksScreen />);
    await fireEvent.press(await findByTestId('match-streaks-back'));

    expect(mockBack).toHaveBeenCalled();
  });
});
