import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getMatchIntro: jest.fn(),
    getLiveScore: jest.fn(),
    getScorecard: jest.fn(),
    recordBall: jest.fn(),
    undoBall: jest.fn(),
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
const mockRecordBall = apiClient.recordBall as jest.Mock;

import ScoringInterfaceScreen from '../app/(tabs)/matches/[matchId]/scoring';

const ROOM = {
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  players: [
    { player_id: 'p1', bfam_id: 'BF1001', invitation_status: 'CONFIRMED' },
    { player_id: 'p2', bfam_id: 'BF1002', invitation_status: 'CONFIRMED' },
    { player_id: 'p3', bfam_id: 'BF1003', invitation_status: 'CONFIRMED' },
  ],
};

const LIVE_SCORE = {
  match_id: 'match-1',
  innings: {
    innings_id: 'innings-1',
    match_id: 'match-1',
    innings_number: 1,
    batting_match_team_id: 'mt-a',
    bowling_match_team_id: 'mt-b',
    total_runs: 0,
    total_wickets: 0,
    overs_completed: 0,
    innings_status: 'IN_PROGRESS',
    target_runs: null,
  },
};

describe('Scoring Interface (backlog A-7: fewer taps)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetLiveScore.mockResolvedValue(LIVE_SCORE);
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });
    mockRecordBall.mockResolvedValue({
      event: {},
      innings: LIVE_SCORE.innings,
      audio_trigger: 'NONE',
    });
  });

  async function renderReady() {
    const utils = render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(utils.getByTestId('scoring-interface-screen')).toBeTruthy());
    fireEvent.press(utils.getByTestId('striker-select-p1'));
    fireEvent.press(utils.getByTestId('non-striker-select-p2'));
    fireEvent.press(utils.getByTestId('bowler-select-p3'));
    return utils;
  }

  it('a one-tap Swap button flips the striker and non-striker', async () => {
    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('swap-strike-button'));

    // p2 (was non-striker) is now the selected striker.
    expect(getByTestId('striker-select-p2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('non-striker-select-p1').props.accessibilityState.selected).toBe(true);
  });

  it('automatically rotates strike after an odd-run ball, with no extra tap', async () => {
    const { getByTestId } = await renderReady();

    await act(async () => {
      fireEvent.press(getByTestId('run-1'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    expect(getByTestId('striker-select-p2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('non-striker-select-p1').props.accessibilityState.selected).toBe(true);
  });

  it('does not rotate strike after an even-run ball', async () => {
    const { getByTestId } = await renderReady();

    await act(async () => {
      fireEvent.press(getByTestId('run-4'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    expect(getByTestId('striker-select-p1').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('non-striker-select-p2').props.accessibilityState.selected).toBe(true);
  });

  it('records the extra runs on top of a wide as runs run for rotation purposes', async () => {
    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('extra-WIDE'));
    await act(async () => {
      fireEvent.press(getByTestId('run-1'));
    });

    await waitFor(() =>
      expect(mockRecordBall).toHaveBeenCalledWith(
        'innings-1',
        expect.objectContaining({ extra_type: 'WIDE', extra_runs: 2, runs_scored: 0 }),
      ),
    );
    expect(getByTestId('striker-select-p2').props.accessibilityState.selected).toBe(true);
  });

  it('clears the striker slot after a confirmed wicket, forcing a fresh pick', async () => {
    const { getByTestId } = await renderReady();

    fireEvent.press(getByTestId('wicket-button'));
    fireEvent.press(getByTestId('wicket-type-BOWLED'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-wicket'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    for (const id of ['striker-select-p1', 'striker-select-p2', 'striker-select-p3']) {
      expect(getByTestId(id).props.accessibilityState.selected).toBe(false);
    }
  });
});
