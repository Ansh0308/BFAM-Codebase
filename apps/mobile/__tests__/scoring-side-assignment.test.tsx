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
    startInnings: jest.fn(),
    setExtrasCountTowardScore: jest.fn(),
  },
}));

jest.mock('../src/lib/sounds', () => ({
  playTriggerSound: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetMatchIntro = apiClient.getMatchIntro as jest.Mock;
const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;
const mockGetScorecard = apiClient.getScorecard as jest.Mock;
const mockAssignSides = apiClient.assignPlayerSides as jest.Mock;
const mockStartInnings = apiClient.startInnings as jest.Mock;
const mockSetExtrasCountTowardScore = apiClient.setExtrasCountTowardScore as jest.Mock;

import ScoringInterfaceScreen from '../app/(tabs)/matches/[matchId]/scoring';

const MATCH_TEAMS = [
  { match_team_id: 'mt-a', side_label: 'TEAM_A' },
  { match_team_id: 'mt-b', side_label: 'TEAM_B' },
];

const ROOM = {
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  players: [
    { player_id: 'p1', bfam_id: 'BF1001', invitation_status: 'CONFIRMED', match_team_id: null },
    { player_id: 'p2', bfam_id: 'BF1002', invitation_status: 'CONFIRMED', match_team_id: null },
  ],
};

// Backlog A-10: batter/bowler selection restricted to the correct side.
describe('Scoring Interface — assign players to a side (backlog A-10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue({
      intro: { background_music_enabled: true },
      matchTeams: MATCH_TEAMS,
    });
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });
    mockAssignSides.mockResolvedValue({ players: [] });
    mockStartInnings.mockResolvedValue(undefined);
    mockSetExtrasCountTowardScore.mockResolvedValue({ extras_count_toward_score: true });
  });

  it('disables Start Innings until every confirmed player has a side', async () => {
    const { getByTestId } = render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('start-innings-screen')).toBeTruthy());

    fireEvent.press(getByTestId('batting-side'));

    expect(getByTestId('start-innings-button').props.accessibilityState.disabled).toBe(true);
  });

  it('enables Start Innings once every player is assigned, then saves the assignments', async () => {
    const { getByTestId } = render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('start-innings-screen')).toBeTruthy());

    fireEvent.press(getByTestId('assign-p1-TEAM_A'));
    fireEvent.press(getByTestId('assign-p2-TEAM_B'));
    fireEvent.press(getByTestId('batting-side-mt-a'));

    expect(getByTestId('start-innings-button').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('start-innings-button'));

    await waitFor(() =>
      expect(mockAssignSides).toHaveBeenCalledWith('match-1', [
        { player_id: 'p1', match_team_id: 'mt-a' },
        { player_id: 'p2', match_team_id: 'mt-b' },
      ]),
    );
    expect(mockStartInnings).toHaveBeenCalled();
  });

  // Backlog A-8: extras-count-toward-score toggle, defaulted on, set once
  // before the very first innings alongside side assignment.
  it('sends the extras toggle when starting the first innings', async () => {
    const { getByTestId } = render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('start-innings-screen')).toBeTruthy());

    fireEvent.press(getByTestId('extras-count-toggle-switch'));
    fireEvent.press(getByTestId('assign-p1-TEAM_A'));
    fireEvent.press(getByTestId('assign-p2-TEAM_B'));
    fireEvent.press(getByTestId('batting-side-mt-a'));
    fireEvent.press(getByTestId('start-innings-button'));

    await waitFor(() =>
      expect(mockSetExtrasCountTowardScore).toHaveBeenCalledWith('match-1', false),
    );
    expect(mockStartInnings).toHaveBeenCalled();
  });
});
