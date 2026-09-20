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
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetMatchIntro = apiClient.getMatchIntro as jest.Mock;
const mockGetMatchResult = apiClient.getMatchResult as jest.Mock;
const mockGetScorecard = apiClient.getScorecard as jest.Mock;
const mockFinalizeMatch = apiClient.finalizeMatch as jest.Mock;

import MatchResultScreen from '../app/(tabs)/matches/[matchId]/result';

// The organizer is the one who reaches the not-yet-finalized finalize form.
const ROOM = {
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  players: [
    { player_id: 'p1', bfam_id: 'BF1001', full_name: null, invitation_status: 'CONFIRMED' },
    { player_id: 'p2', bfam_id: 'BF1002', full_name: null, invitation_status: 'CONFIRMED' },
    { player_id: 'p3', bfam_id: 'BF1003', full_name: null, invitation_status: 'CONFIRMED' },
  ],
};

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string } }) => unknown) =>
    selector({ user: { user_id: 'organizer-user' } }),
}));

// A-24: "the system should automatically select the Player of the Match
// based on overall performance" — pre-filled, not locked, so the organizer
// can still override it.
describe('Match Result screen — Player of the Match auto-suggestion (backlog A-24)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetMatchResult.mockResolvedValue(null);
  });

  it('pre-selects the player with the highest runs+wickets points as Player of the Match', async () => {
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [
        {
          innings_id: 'innings-1',
          innings_number: 1,
          total_runs: 150,
          total_wickets: 4,
          overs_completed: 20,
          run_rate: 7.5,
          batting: [
            {
              player_id: 'p1',
              bfam_id: 'BF1001',
              runs: 80,
              balls: 50,
              fours: 8,
              sixes: 2,
              out: false,
            },
            {
              player_id: 'p2',
              bfam_id: 'BF1002',
              runs: 20,
              balls: 15,
              fours: 1,
              sixes: 0,
              out: true,
            },
          ],
          bowling: [
            {
              player_id: 'p3',
              bfam_id: 'BF1003',
              overs: 4,
              runs_conceded: 25,
              wickets: 3,
              economy: 6.25,
            },
          ],
          extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
          fall_of_wickets: [],
        },
      ],
    });

    const { findByTestId, getByTestId } = await render(<MatchResultScreen />);
    await findByTestId('finalize-result-screen');

    // p1: 80 points (runs). p3: 3 * 20 = 60 points (wickets). p1 wins.
    await waitFor(() =>
      expect(getByTestId('potm-select-p1').props.accessibilityState.selected).toBe(true),
    );
    expect(getByTestId('potm-select-p3').props.accessibilityState.selected).toBe(false);
  });

  it('a bowling-heavy performance can outscore a smaller batting one', async () => {
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [
        {
          innings_id: 'innings-1',
          innings_number: 1,
          total_runs: 90,
          total_wickets: 5,
          overs_completed: 20,
          run_rate: 4.5,
          batting: [
            {
              player_id: 'p1',
              bfam_id: 'BF1001',
              runs: 30,
              balls: 40,
              fours: 2,
              sixes: 0,
              out: true,
            },
          ],
          bowling: [
            {
              player_id: 'p3',
              bfam_id: 'BF1003',
              overs: 4,
              runs_conceded: 15,
              wickets: 4,
              economy: 3.75,
            },
          ],
          extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
          fall_of_wickets: [],
        },
      ],
    });

    const { findByTestId, getByTestId } = await render(<MatchResultScreen />);
    await findByTestId('finalize-result-screen');

    // p3: 4 * 20 = 80 points (wickets) beats p1's 30 points (runs).
    await waitFor(() =>
      expect(getByTestId('potm-select-p3').props.accessibilityState.selected).toBe(true),
    );
  });

  it('lets the organizer override the suggestion and finalizes with that pick', async () => {
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [
        {
          innings_id: 'innings-1',
          innings_number: 1,
          total_runs: 150,
          total_wickets: 4,
          overs_completed: 20,
          run_rate: 7.5,
          batting: [
            {
              player_id: 'p1',
              bfam_id: 'BF1001',
              runs: 80,
              balls: 50,
              fours: 8,
              sixes: 2,
              out: false,
            },
          ],
          bowling: [],
          extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
          fall_of_wickets: [],
        },
      ],
    });
    mockFinalizeMatch.mockResolvedValue({ result_id: 'r1' });

    const { findByTestId, getByTestId } = await render(<MatchResultScreen />);
    await findByTestId('finalize-result-screen');
    await waitFor(() =>
      expect(getByTestId('potm-select-p1').props.accessibilityState.selected).toBe(true),
    );

    await fireEvent.press(getByTestId('potm-select-p2'));
    await fireEvent.press(getByTestId('finalize-button'));

    await waitFor(() =>
      expect(mockFinalizeMatch).toHaveBeenCalledWith(
        'match-1',
        expect.objectContaining({ player_of_the_match_id: 'p2' }),
      ),
    );
  });

  it('does not suggest a player before there is any scoring data', async () => {
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });

    const { findByTestId, getByTestId } = await render(<MatchResultScreen />);
    await findByTestId('finalize-result-screen');

    expect(getByTestId('potm-select-p1').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('potm-select-p2').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('potm-select-p3').props.accessibilityState.selected).toBe(false);
  });
});
