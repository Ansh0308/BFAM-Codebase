import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getMatchIntro: jest.fn(),
    getMatchResult: jest.fn(),
    getScorecard: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetMatchIntro = apiClient.getMatchIntro as jest.Mock;
const mockGetMatchResult = apiClient.getMatchResult as jest.Mock;
const mockGetScorecard = apiClient.getScorecard as jest.Mock;

import MatchResultScreen from '../app/(tabs)/matches/[matchId]/result';

const ROOM = {
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  players: [{ player_id: 'p1', bfam_id: 'BF1001', invitation_status: 'CONFIRMED' }],
};

// Backlog B-4: the Match Result screen's link into the review flow.
describe('Match Result screen — Rate This Match link (backlog B-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetMatchResult.mockResolvedValue({
      result_id: 'r1',
      match_id: 'match-1',
      winning_match_team_id: 'mt-a',
      result_type: 'WIN',
      winning_margin: '10 runs',
      player_of_the_match_id: null,
      finalized_at: '',
    });
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });
  });

  it('navigates to the review screen for this match', async () => {
    const { findByTestId } = await render(<MatchResultScreen />);

    await fireEvent.press(await findByTestId('open-review'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/match-review?matchId=match-1'));
  });
});
