import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
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
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
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

describe('Scoring Interface (backlog A-7: fewer taps; UI rebuild per reference screenshot)', () => {
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

  // A player-picker row is collapsed by default — open it, then tap the
  // option, same as the reference design's tap-to-open row cards.
  async function selectPlayer(
    utils: Awaited<ReturnType<typeof render>>,
    rowTestId: string,
    playerId: string,
  ) {
    await fireEvent.press(utils.getByTestId(rowTestId));
    await fireEvent.press(utils.getByTestId(`${rowTestId}-options-${playerId}`));
  }

  async function renderReady() {
    const utils = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(utils.getByTestId('scoring-interface-screen')).toBeTruthy());
    await selectPlayer(utils, 'striker-select', 'p1');
    await selectPlayer(utils, 'non-striker-select', 'p2');
    await selectPlayer(utils, 'bowler-select', 'p3');
    return utils;
  }

  it('a one-tap Swap button flips the striker and non-striker', async () => {
    const { getByTestId } = await renderReady();

    await fireEvent.press(getByTestId('swap-strike-button'));

    // p2 (was non-striker) is now shown as the selected striker, and vice versa.
    expect(within(getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
    expect(within(getByTestId('non-striker-select')).getByText('BF1001')).toBeTruthy();
  });

  it('automatically rotates strike after an odd-run ball, with no extra tap', async () => {
    const { getByTestId } = await renderReady();

    await act(async () => {
      await fireEvent.press(getByTestId('run-1'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    expect(within(getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
    expect(within(getByTestId('non-striker-select')).getByText('BF1001')).toBeTruthy();
  });

  it('does not rotate strike after an even-run ball', async () => {
    const { getByTestId } = await renderReady();

    await act(async () => {
      await fireEvent.press(getByTestId('run-4'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    expect(within(getByTestId('striker-select')).getByText('BF1001')).toBeTruthy();
    expect(within(getByTestId('non-striker-select')).getByText('BF1002')).toBeTruthy();
  });

  it('records the extra runs on top of a wide as runs run for rotation purposes', async () => {
    const { getByTestId } = await renderReady();

    await fireEvent.press(getByTestId('extra-WIDE'));
    await act(async () => {
      await fireEvent.press(getByTestId('run-1'));
    });

    await waitFor(() =>
      expect(mockRecordBall).toHaveBeenCalledWith(
        'innings-1',
        expect.objectContaining({ extra_type: 'WIDE', extra_runs: 2, runs_scored: 0 }),
      ),
    );
    expect(within(getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
  });

  it('clears the striker slot after a confirmed wicket, forcing a fresh pick', async () => {
    const { getByTestId } = await renderReady();

    await fireEvent.press(getByTestId('wicket-button'));
    await fireEvent.press(getByTestId('wicket-type-BOWLED'));
    await act(async () => {
      await fireEvent.press(getByTestId('confirm-wicket'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    expect(within(getByTestId('striker-select')).getByText('Not Selected')).toBeTruthy();
  });

  it('shows the current-over dots and fills one in after each legal ball', async () => {
    const { getByTestId } = await renderReady();

    // All six start as placeholders.
    for (let i = 0; i < 6; i++) {
      expect(within(getByTestId(`over-dot-${i}`)).getByText('-')).toBeTruthy();
    }

    await act(async () => {
      await fireEvent.press(getByTestId('run-4'));
    });
    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());

    expect(within(getByTestId('over-dot-0')).getByText('4')).toBeTruthy();
    expect(within(getByTestId('over-dot-1')).getByText('-')).toBeTruthy();
  });
});
