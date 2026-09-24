import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getPlayerAchievements: jest.fn() },
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockGetPlayerAchievements = apiClient.getPlayerAchievements as jest.Mock;

import AchievementsScreen from '../app/achievements';

const ACHIEVEMENTS = [
  { id: 'FIRST_MATCH', name: 'First Match', description: 'Played your first match.', earned: true },
  { id: 'CENTURY_CLUB', name: 'Century Club', description: 'Scored 100+ runs.', earned: false },
];

// Long tail — Achievements & Badges (PRD §12.37).
describe('AchievementsScreen (long tail — Achievements & Badges)', () => {
  beforeEach(() => {
    mockGetPlayerAchievements.mockReset();
    mockBack.mockReset();
  });

  it('shows the earned count and every achievement, earned or not', async () => {
    mockGetPlayerAchievements.mockResolvedValueOnce({ results: ACHIEVEMENTS });

    const { findByTestId, findByText } = await render(<AchievementsScreen />);

    expect((await findByTestId('achievements-count')).props.children.join('')).toContain('1 of 2');
    expect(await findByText('First Match')).toBeTruthy();
    expect(await findByText('Century Club')).toBeTruthy();
  });

  it('shows an error message when loading fails', async () => {
    mockGetPlayerAchievements.mockRejectedValueOnce(new Error('network down'));

    const { findByText } = await render(<AchievementsScreen />);

    expect(await findByText(/could not load your achievements/i)).toBeTruthy();
  });

  it('navigates back on the back button', async () => {
    mockGetPlayerAchievements.mockResolvedValueOnce({ results: ACHIEVEMENTS });

    const { findByTestId } = await render(<AchievementsScreen />);
    await fireEvent.press(await findByTestId('achievements-back'));

    expect(mockBack).toHaveBeenCalled();
  });
});
