import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getMatchIntro: jest.fn(),
    getMatchResult: jest.fn(),
    getScorecard: jest.fn(),
    finalizeMatch: jest.fn(),
    getViewerCount: jest.fn().mockResolvedValue({ active: 0, total: 0, peak: 0 }),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

let mockUserId = 'organizer-user';
jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string } }) => unknown) =>
    selector({ user: { user_id: mockUserId } }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetMatchIntro = apiClient.getMatchIntro as jest.Mock;
const mockGetMatchResult = apiClient.getMatchResult as jest.Mock;
const mockGetScorecard = apiClient.getScorecard as jest.Mock;
const mockFinalize = apiClient.finalizeMatch as jest.Mock;

import MatchResultScreen from '../app/(tabs)/matches/[matchId]/result';

const ROOM = {
  match_name: 'Sunday Derby',
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  players: [],
};

const RESULT = {
  result_id: 'r1',
  match_id: 'match-1',
  winning_match_team_id: 'mt-a',
  winning_team_name: 'Royals',
  result_type: 'WIN' as const,
  winning_margin: '10 runs',
  player_of_the_match_id: 'p1',
  player_of_the_match_bfam_id: 'BFDEMO16300602',
  player_of_the_match_name: 'Asha Rao',
  player_of_the_match_stats: { runs: 36, balls: 8, wickets: 2, runs_conceded: 14 },
  finalized_at: '',
};

const SCORECARD = {
  match_id: 'match-1',
  extras_count_toward_score: true,
  innings: [
    {
      innings_id: 'i1',
      innings_number: 1,
      batting_match_team_id: 'mt-a',
      batting_team_name: 'Royals',
      total_runs: 100,
      total_wickets: 5,
      overs_completed: 6,
      run_rate: 16.67,
      batting: [],
      bowling: [],
      extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
      fall_of_wickets: [],
    },
    {
      innings_id: 'i2',
      innings_number: 2,
      batting_match_team_id: 'mt-b',
      batting_team_name: 'Owls',
      total_runs: 90,
      total_wickets: 8,
      overs_completed: 6,
      run_rate: 15,
      batting: [],
      bowling: [],
      extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
      fall_of_wickets: [],
    },
  ],
};

// Match revamp: no manual "Finalize Result" form — landing on the screen
// finalizes automatically and shows the summary straight away.
describe('Match Result screen — automatic result', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'organizer-user';
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetScorecard.mockResolvedValue(SCORECARD);
  });

  it('finalizes automatically for the organizer and shows the winner, margin and both scores', async () => {
    mockGetMatchResult.mockRejectedValueOnce(new Error('404')).mockResolvedValue(RESULT);
    mockFinalize.mockResolvedValue({ result_id: 'r1' });

    const { findByTestId, queryByTestId } = await render(<MatchResultScreen />);

    expect((await findByTestId('result-headline')).props.children).toBe('ROYALS WON');
    expect(mockFinalize).toHaveBeenCalledWith('match-1');
    expect((await findByTestId('result-margin')).props.children.join('')).toBe('by 10 runs');
    expect(await findByTestId('scoreboard-innings-1')).toBeTruthy();
    expect(await findByTestId('scoreboard-innings-2')).toBeTruthy();
    // No manual form any more.
    expect(queryByTestId('finalize-result-screen')).toBeNull();
    expect(queryByTestId('finalize-button')).toBeNull();
  });

  it('shows the Player of the Match by NAME with their stats, never the BFAM ID', async () => {
    mockGetMatchResult.mockResolvedValue(RESULT);
    const { findByTestId, queryByText } = await render(<MatchResultScreen />);

    expect((await findByTestId('potm-name')).props.children).toBe('Asha Rao');
    expect((await findByTestId('potm-stats')).props.children).toBe(
      '36 runs (8 balls)  ·  2 wickets',
    );
    expect(queryByText(/BFDEMO16300602/)).toBeNull();
    expect(mockFinalize).not.toHaveBeenCalled(); // already finalized
  });

  it('falls back to the BFAM ID only when the player never set a name', async () => {
    mockGetMatchResult.mockResolvedValue({ ...RESULT, player_of_the_match_name: null });
    const { findByTestId } = await render(<MatchResultScreen />);
    expect((await findByTestId('potm-name')).props.children).toBe('BFDEMO16300602');
  });

  it('does not try to finalize for a viewer who is not organizer/scorer', async () => {
    mockUserId = 'someone-else';
    mockGetMatchResult.mockRejectedValue(new Error('404'));
    const { findByTestId } = await render(<MatchResultScreen />);
    expect(await findByTestId('result-not-finalized')).toBeTruthy();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it('shows "Match tied" for a tie', async () => {
    mockGetMatchResult.mockResolvedValue({
      ...RESULT,
      result_type: 'TIE',
      winning_match_team_id: null,
      winning_team_name: null,
      winning_margin: null,
    });
    const { findByTestId } = await render(<MatchResultScreen />);
    expect((await findByTestId('result-headline')).props.children).toBe('MATCH TIED');
  });

  it('offers a retry when automatic finalization fails', async () => {
    mockGetMatchResult.mockRejectedValue(new Error('404'));
    mockFinalize
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ result_id: 'r1' });
    const { findByTestId } = await render(<MatchResultScreen />);

    await fireEvent.press(await findByTestId('result-retry'));
    mockGetMatchResult.mockResolvedValue(RESULT);
    await waitFor(() => expect(mockFinalize).toHaveBeenCalledTimes(2));
  });
});
