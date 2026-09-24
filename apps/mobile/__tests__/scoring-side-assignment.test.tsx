import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getMatchIntro: jest.fn(),
    getLiveScore: jest.fn(),
    getScorecard: jest.fn(),
    assignPlayerSides: jest.fn(),
    setExtrasCountTowardScore: jest.fn(),
    startInnings: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetMatchIntro = apiClient.getMatchIntro as jest.Mock;
const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;
const mockGetScorecard = apiClient.getScorecard as jest.Mock;
const mockAssign = apiClient.assignPlayerSides as jest.Mock;
const mockSetExtras = apiClient.setExtrasCountTowardScore as jest.Mock;
const mockStart = apiClient.startInnings as jest.Mock;

import ScoringInterfaceScreen from '../app/(tabs)/matches/[matchId]/scoring';

// Matches created before Match Setup existed can still reach scoring with
// players who have no side — the old assignment step survives as a fallback,
// shown only in that case (backlog A-10).
const ROOM = {
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  overs_per_innings: 6,
  players: [
    { player_id: 'p1', bfam_id: 'BF1001', invitation_status: 'CONFIRMED', match_team_id: null },
    { player_id: 'p2', bfam_id: 'BF1002', invitation_status: 'CONFIRMED', match_team_id: null },
  ],
};

describe('Scoring Interface — legacy side assignment fallback (backlog A-10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue({
      intro: {
        background_music_enabled: false,
        toss_winner_match_team_id: 'mt-a',
        toss_decision: 'BAT',
        toss_completed_at: 'now',
      },
      matchTeams: [
        { match_team_id: 'mt-a', side_label: 'TEAM_A' },
        { match_team_id: 'mt-b', side_label: 'TEAM_B' },
      ],
    });
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });
    mockAssign.mockResolvedValue({ players: [] });
    mockSetExtras.mockResolvedValue({});
    mockStart.mockResolvedValue({});
  });

  it('disables Start Innings until every player has a side', async () => {
    const { findByTestId, getByTestId } = await render(<ScoringInterfaceScreen />);
    expect(await findByTestId('legacy-sides')).toBeTruthy();

    await fireEvent.press(getByTestId('start-innings-button'));
    expect(mockStart).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('assign-p1-TEAM_A'));
    await fireEvent.press(getByTestId('assign-p2-TEAM_B'));
    await fireEvent.press(getByTestId('start-innings-button'));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
  });

  it('saves the assignments and the extras toggle when starting the first innings', async () => {
    const { findByTestId, getByTestId } = await render(<ScoringInterfaceScreen />);
    await findByTestId('legacy-sides');

    await fireEvent.press(getByTestId('assign-p1-TEAM_A'));
    await fireEvent.press(getByTestId('assign-p2-TEAM_B'));
    await fireEvent(getByTestId('extras-count-toggle'), 'valueChange', false);
    await fireEvent.press(getByTestId('start-innings-button'));

    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith('match-1', [
        { player_id: 'p1', match_team_id: 'mt-a' },
        { player_id: 'p2', match_team_id: 'mt-b' },
      ]),
    );
    expect(mockSetExtras).toHaveBeenCalledWith('match-1', false);
    expect(mockStart).toHaveBeenCalledWith(
      'match-1',
      expect.objectContaining({ batting_match_team_id: 'mt-a', bowling_match_team_id: 'mt-b' }),
    );
  });
});
