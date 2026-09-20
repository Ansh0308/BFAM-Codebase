import React from 'react';
import { render } from '@testing-library/react-native';
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
