import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookingId: 'booking-1' }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../src/store/rebookStore', () => ({
  useRebookStore: (selector: (s: { plan: null; clear: () => void }) => unknown) =>
    selector({ plan: null, clear: jest.fn() }),
}));

const mockCreateMatch = jest.fn();
const mockGetMyTeams = jest.fn();
const mockSearchTeams = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    createMatch: (...args: unknown[]) => mockCreateMatch(...args),
    getMyTeams: (...args: unknown[]) => mockGetMyTeams(...args),
    searchTeams: (...args: unknown[]) => mockSearchTeams(...args),
  },
}));

import CreateMatchScreen from '../app/(tabs)/matches/create';

// Backlog G-20: Create Match's optional team-vs-team step — "Your Team"
// (from the organizer's own memberships) and "Opponent Team" (searched by
// name), sent through as home_team_id/away_team_id only when both are set.
describe('Create Match screen — team-vs-team picker (backlog G-20)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateMatch.mockResolvedValue({ match_id: 'match-1' });
    mockGetMyTeams.mockResolvedValue({
      results: [{ team_id: 'team-home', team_name: 'Rajkot Royals', role_in_team: 'CAPTAIN' }],
    });
    mockSearchTeams.mockResolvedValue({
      results: [{ team_id: 'team-away', team_name: 'Night Owls CC' }],
    });
  });

  it('creates an ad-hoc match with no team ids when Team Match is left off', async () => {
    const { getByTestId } = await render(<CreateMatchScreen />);

    await fireEvent.press(getByTestId('submit-create-match'));

    await waitFor(() =>
      expect(mockCreateMatch).toHaveBeenCalledWith(
        expect.objectContaining({ home_team_id: null, away_team_id: null }),
      ),
    );
    expect(mockGetMyTeams).not.toHaveBeenCalled();
  });

  it("auto-selects the organizer's only team, then sends both team ids once an opponent is picked", async () => {
    const { getByTestId, findByTestId, findByText } = await render(<CreateMatchScreen />);

    await fireEvent.press(getByTestId('team-match-toggle-switch'));
    await findByTestId('home-team-option-team-home');

    fireEvent.changeText(getByTestId('opponent-team-search-input'), 'night');
    const opponentOption = await findByTestId('opponent-team-option-team-away');
    await fireEvent.press(opponentOption);
    await findByText('Night Owls CC');

    await fireEvent.press(getByTestId('submit-create-match'));

    await waitFor(() =>
      expect(mockCreateMatch).toHaveBeenCalledWith(
        expect.objectContaining({ home_team_id: 'team-home', away_team_id: 'team-away' }),
      ),
    );
  });

  it('blocks submission when Team Match is on but the opponent has not been picked yet', async () => {
    const { getByTestId, findByTestId, findByText } = await render(<CreateMatchScreen />);

    await fireEvent.press(getByTestId('team-match-toggle-switch'));
    await findByTestId('home-team-option-team-home');

    await fireEvent.press(getByTestId('submit-create-match'));

    await findByText(/pick both your team and the opponent team/i);
    expect(mockCreateMatch).not.toHaveBeenCalled();
  });
});
