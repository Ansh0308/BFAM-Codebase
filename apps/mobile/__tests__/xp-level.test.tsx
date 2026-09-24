import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getPlayerLevel: jest.fn(), getPlayerXpHistory: jest.fn() },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockGetPlayerLevel = apiClient.getPlayerLevel as jest.Mock;
const mockGetPlayerXpHistory = apiClient.getPlayerXpHistory as jest.Mock;

import XpLevelScreen from '../app/xp-level';

const PROGRESS = {
  xp_total: 150,
  level: 'Rookie',
  xp_into_level: 50,
  xp_for_next_level: 200,
  next_level: 'Player',
  progress_percent: 25,
};

// Long tail — XP & Player Levels (PRD §12.35).
describe('XpLevelScreen (long tail — XP & Player Levels)', () => {
  beforeEach(() => {
    mockGetPlayerLevel.mockReset();
    mockGetPlayerXpHistory.mockReset();
    mockBack.mockReset();
  });

  it('shows the current level, XP total, and progress to the next level', async () => {
    mockGetPlayerLevel.mockResolvedValueOnce(PROGRESS);
    mockGetPlayerXpHistory.mockResolvedValueOnce({ results: [] });

    const { findByTestId } = await render(<XpLevelScreen />);

    expect((await findByTestId('level-name')).props.children).toBe('Rookie');
    expect((await findByTestId('xp-total')).props.children).toEqual([150, ' XP']);
    expect(await findByTestId('xp-history-empty')).toBeTruthy();
  });

  it('shows XP history entries with a friendly reason label', async () => {
    mockGetPlayerLevel.mockResolvedValueOnce(PROGRESS);
    mockGetPlayerXpHistory.mockResolvedValueOnce({
      results: [
        {
          xp_transaction_id: 'xp-1',
          reason: 'REVIEW_REWARD',
          amount: 10,
          resulting_total: 150,
          related_entity_type: 'review',
          related_entity_id: 'review-1',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const { findByTestId, findByText } = await render(<XpLevelScreen />);

    expect(await findByTestId('xp-history-row-xp-1')).toBeTruthy();
    expect(await findByText('Submitted a review')).toBeTruthy();
    expect(await findByText('+10')).toBeTruthy();
  });

  it('shows "Max level reached" when there is no next level', async () => {
    mockGetPlayerLevel.mockResolvedValueOnce({
      xp_total: 5000,
      level: 'Legend',
      xp_into_level: 2000,
      xp_for_next_level: null,
      next_level: null,
      progress_percent: 100,
    });
    mockGetPlayerXpHistory.mockResolvedValueOnce({ results: [] });

    const { findByText } = await render(<XpLevelScreen />);

    expect(await findByText('Max level reached')).toBeTruthy();
  });

  it('shows an error message when loading fails', async () => {
    mockGetPlayerLevel.mockRejectedValueOnce(new Error('network down'));
    mockGetPlayerXpHistory.mockResolvedValueOnce({ results: [] });

    const { findByText } = await render(<XpLevelScreen />);

    expect(await findByText(/could not load your level/i)).toBeTruthy();
  });

  it('navigates back on the back button', async () => {
    mockGetPlayerLevel.mockResolvedValueOnce(PROGRESS);
    mockGetPlayerXpHistory.mockResolvedValueOnce({ results: [] });

    const { findByTestId } = await render(<XpLevelScreen />);
    await fireEvent.press(await findByTestId('xp-level-back'));

    expect(mockBack).toHaveBeenCalled();
  });
});
