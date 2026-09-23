import React from 'react';
import { render, within } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getScorecard: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
}));

const mockGetScorecard = apiClient.getScorecard as jest.Mock;

import ScorecardScreen from '../app/(tabs)/matches/[matchId]/scorecard';

// A-22: run rate alongside the batting/bowling tables this screen already
// shows (bowler economy was already here — this adds the team-level number).
describe('Scorecard screen — run rate (backlog A-22)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
          batting: [],
          bowling: [],
          extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
          fall_of_wickets: [],
        },
      ],
    });
  });

  it('shows the run rate for each innings', async () => {
    const { findByText } = await render(<ScorecardScreen />);

    expect(await findByText(/Run Rate: 9\.86/)).toBeTruthy();
  });
});

// Backlog A-18: name-instead-of-BFAM-ID.
describe('Scorecard screen — names, not raw BFAM IDs (backlog A-18)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [
        {
          innings_id: 'innings-1',
          innings_number: 1,
          total_runs: 20,
          total_wickets: 1,
          overs_completed: 3.0,
          run_rate: 6.67,
          batting: [
            {
              player_id: 'p1',
              bfam_id: 'BF1001',
              full_name: 'Asha Patel',
              runs: 15,
              balls: 10,
              fours: 2,
              sixes: 0,
              out: false,
            },
          ],
          bowling: [
            {
              player_id: 'p2',
              bfam_id: 'BF1002',
              full_name: null,
              overs: 3,
              runs_conceded: 20,
              wickets: 1,
              economy: 6.67,
            },
          ],
          extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0 },
          fall_of_wickets: [
            {
              wicket_number: 1,
              score: 20,
              over: 2.4,
              player_id: 'p3',
              bfam_id: 'BF1003',
              full_name: 'Karan Patel',
            },
          ],
        },
      ],
    });
  });

  it("shows the batter's name instead of their BFAM ID", async () => {
    const { findByTestId, queryByText } = await render(<ScorecardScreen />);

    const row = await findByTestId('batting-row-p1');
    expect(within(row).getByText(/Asha Patel/)).toBeTruthy();
    expect(queryByText('BF1001')).toBeNull();
  });

  it("falls back to the bowler's BFAM ID when no name is set", async () => {
    const { findByTestId } = await render(<ScorecardScreen />);

    const row = await findByTestId('bowling-row-p2');
    expect(within(row).getByText('BF1002')).toBeTruthy();
  });

  it("shows the dismissed player's name in the fall-of-wickets summary", async () => {
    const { findByText } = await render(<ScorecardScreen />);

    expect(await findByText(/Karan Patel/)).toBeTruthy();
  });
});
