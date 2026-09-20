import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
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

// A-22: "the statistics section should display run rate, bowler economy,
// and other relevant batting and bowling statistics" at match end — this
// screen is where a viewer actually lands when the match finishes.
describe('Match Result screen — Match Summary (backlog A-22)', () => {
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
      innings: [
        {
          innings_id: 'innings-1',
          innings_number: 1,
          total_runs: 142,
          total_wickets: 3,
          overs_completed: 14.2,
          run_rate: 9.86,
          batting: [
            {
              player_id: 'p1',
              bfam_id: 'BF1001',
              runs: 65,
              balls: 40,
              fours: 6,
              sixes: 2,
              out: true,
            },
            {
              player_id: 'p2',
              bfam_id: 'BF1002',
              runs: 40,
              balls: 30,
              fours: 3,
              sixes: 1,
              out: false,
            },
          ],
          bowling: [
            {
              player_id: 'p3',
              bfam_id: 'BF1003',
              overs: 4,
              runs_conceded: 20,
              wickets: 2,
              economy: 5,
            },
            {
              player_id: 'p4',
              bfam_id: 'BF1004',
              overs: 4,
              runs_conceded: 30,
              wickets: 1,
              economy: 7.5,
            },
          ],
          extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
          fall_of_wickets: [],
        },
      ],
    });
  });

  it('shows run rate, top score, and best bowling for each innings', async () => {
    const { findByTestId } = await render(<MatchResultScreen />);

    const summary = await findByTestId('match-summary-innings-1');
    expect(within(summary).getByText('Run Rate: 9.86')).toBeTruthy();
    // p1 (65 runs) beats p2 (40 runs) for top score, even though p1 is out.
    expect(within(summary).getByText(/Top Score: BF1001 — 65/)).toBeTruthy();
    // p3 (2 wickets) beats p4 (1 wicket) for best bowling.
    expect(within(summary).getByText(/Best Bowling: BF1003 — 2\/20/)).toBeTruthy();
  });

  it("links to the full scorecard instead of the viewer's own lifetime stats", async () => {
    const { findByTestId } = await render(<MatchResultScreen />);

    await fireEvent.press(await findByTestId('open-scorecard'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/match-1/scorecard'));
  });

  it('does not render a summary block when there is no scoring data', async () => {
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });

    const { findByTestId, queryByTestId } = await render(<MatchResultScreen />);
    await findByTestId('result-display');

    expect(queryByTestId('match-summary')).toBeNull();
  });
});
