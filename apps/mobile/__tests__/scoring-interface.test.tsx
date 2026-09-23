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
    expect(mockRecordBall).toHaveBeenCalledWith(
      'innings-1',
      expect.objectContaining({ dismissed_player_id: 'p1' }),
    );
    expect(within(getByTestId('striker-select')).getByText('Not Selected')).toBeTruthy();
  });

  // A-20: every wicket type except RUN_OUT always dismisses the striker —
  // no extra question needed.
  it('does not ask who is out for a non-run-out wicket', async () => {
    const { getByTestId, queryByTestId } = await renderReady();

    await fireEvent.press(getByTestId('wicket-button'));
    await fireEvent.press(getByTestId('wicket-type-CAUGHT'));

    expect(queryByTestId('run-out-dismissed-select')).toBeNull();
    expect(getByTestId('confirm-wicket').props.accessibilityState?.disabled).not.toBe(true);
  });

  // A-20: "the system should ask which batter is getting out" for a
  // run-out, since either end could be the one dismissed.
  it('asks which end was run out and clears that end, not always the striker', async () => {
    const { getByTestId } = await renderReady();

    await fireEvent.press(getByTestId('wicket-button'));
    await fireEvent.press(getByTestId('wicket-type-RUN_OUT'));

    // Can't confirm yet — nobody's been picked as the dismissed batter.
    expect(getByTestId('confirm-wicket').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(getByTestId('run-out-dismissed-select-p2'));
    await act(async () => {
      await fireEvent.press(getByTestId('confirm-wicket'));
    });

    await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
    expect(mockRecordBall).toHaveBeenCalledWith(
      'innings-1',
      expect.objectContaining({ wicket_type: 'RUN_OUT', dismissed_player_id: 'p2' }),
    );
    // The non-striker (p2) was run out, so the striker slot (p1) stays put
    // and the non-striker slot is the one cleared for a fresh pick.
    expect(within(getByTestId('striker-select')).getByText('BF1001')).toBeTruthy();
    expect(within(getByTestId('non-striker-select')).getByText('Not Selected')).toBeTruthy();
  });

  // A-20: "The batter who gets out must not be allowed to bat again."
  it('blocks a dismissed batter from being reselected as striker or non-striker', async () => {
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [
        {
          innings_id: 'innings-1',
          batting: [
            {
              player_id: 'p1',
              bfam_id: 'BF1001',
              runs: 10,
              balls: 8,
              fours: 1,
              sixes: 0,
              out: true,
            },
            {
              player_id: 'p2',
              bfam_id: 'BF1002',
              runs: 5,
              balls: 6,
              fours: 0,
              sixes: 0,
              out: false,
            },
          ],
        },
      ],
    });
    const utils = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(utils.getByTestId('scoring-interface-screen')).toBeTruthy());

    await fireEvent.press(utils.getByTestId('striker-select'));
    expect(utils.queryByTestId('striker-select-options-p1')).toBeNull();
    expect(utils.queryByTestId('striker-select-options-p2')).toBeTruthy();

    await fireEvent.press(utils.getByTestId('non-striker-select'));
    expect(utils.queryByTestId('non-striker-select-options-p1')).toBeNull();
  });

  // A batter can't stand at both ends at once — found while manually
  // testing the "Start Innings" flow: picking p1 as striker still let it
  // be picked as non-striker too, silently letting one player occupy both
  // slots.
  it('excludes the striker from the non-striker picker and vice versa', async () => {
    const utils = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(utils.getByTestId('scoring-interface-screen')).toBeTruthy());

    await selectPlayer(utils, 'striker-select', 'p1');

    await fireEvent.press(utils.getByTestId('non-striker-select'));
    expect(utils.queryByTestId('non-striker-select-options-p1')).toBeNull();
    expect(utils.queryByTestId('non-striker-select-options-p2')).toBeTruthy();
    await fireEvent.press(utils.getByTestId('non-striker-select-options-p2'));

    await fireEvent.press(utils.getByTestId('striker-select'));
    expect(utils.queryByTestId('striker-select-options-p2')).toBeNull();
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

  // Feedback: scoring shouldn't be gated on who tapped Confirm in the app.
  it('offers a PENDING player as a striker/bowler pick, but not a CANT_PLAY player', async () => {
    mockGetGameRoom.mockResolvedValue({
      ...ROOM,
      players: [
        ...ROOM.players,
        { player_id: 'p4', bfam_id: 'BF1004', invitation_status: 'PENDING' },
        { player_id: 'p5', bfam_id: 'BF1005', invitation_status: 'CANT_PLAY' },
      ],
    });
    const utils = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(utils.getByTestId('scoring-interface-screen')).toBeTruthy());
    await fireEvent.press(utils.getByTestId('striker-select'));

    expect(utils.queryByTestId('striker-select-options-p4')).toBeTruthy();
    expect(utils.queryByTestId('striker-select-options-p5')).toBeNull();
  });
});

describe('Scoring Interface — toss auto-fill (feedback: do not re-ask after the toss)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });
    mockGetScorecard.mockResolvedValue(null);
  });

  it('pre-selects Batting/Bowling Side from the recorded toss result', async () => {
    mockGetMatchIntro.mockResolvedValue({
      intro: {
        toss_winner_match_team_id: 'mt-b',
        toss_decision: 'BOWL',
      },
      matchTeams: [
        { match_team_id: 'mt-a', side_label: 'TEAM_A' },
        { match_team_id: 'mt-b', side_label: 'TEAM_B' },
      ],
      players: [],
    });

    const { getByTestId } = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('start-innings-screen')).toBeTruthy());

    // Toss winner (Team B) chose to bowl, so Team A bats — pre-selected
    // without the organizer touching the Batting Side picker at all.
    await waitFor(() =>
      expect(getByTestId('batting-side-mt-a').props.accessibilityState.selected).toBe(true),
    );
  });
});

// A-21: the backend auto-completes an innings once wickets hit the cap —
// the screen should make that obvious instead of leaving the run/wicket
// buttons up as if scoring could continue.
describe('Scoring Interface — all-out banner (backlog A-21)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetLiveScore.mockResolvedValue({
      match_id: 'match-1',
      innings: { ...LIVE_SCORE.innings, total_wickets: 7, innings_status: 'COMPLETED' },
    });
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });
  });

  it('shows an all-out banner and hides the run/wicket controls once the innings is auto-completed', async () => {
    const { getByTestId, queryByTestId } = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('scoring-interface-screen')).toBeTruthy());

    expect(within(getByTestId('innings-all-out-banner')).getByText(/All out/)).toBeTruthy();
    expect(queryByTestId('wicket-button')).toBeNull();
    expect(queryByTestId('run-1')).toBeNull();
  });
});

// A-19: the same banner slot, but for the other two ways an innings can
// auto-complete — a chased target or the overs allotment running out —
// which used to always say "All out" regardless of the real reason.
describe('Scoring Interface — completion banner shows the real reason (backlog A-19)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetScorecard.mockResolvedValue({
      match_id: 'match-1',
      extras_count_toward_score: true,
      innings: [],
    });
  });

  it('shows a "Target chased" banner instead of "All out" when the innings completed by reaching the target', async () => {
    mockGetLiveScore.mockResolvedValue({
      match_id: 'match-1',
      overs_per_innings: 8,
      innings: {
        ...LIVE_SCORE.innings,
        innings_number: 2,
        target_runs: 60,
        total_runs: 61,
        total_wickets: 2,
        innings_status: 'COMPLETED',
      },
    });

    const { getByTestId } = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('scoring-interface-screen')).toBeTruthy());

    expect(within(getByTestId('innings-all-out-banner')).getByText(/Target chased/)).toBeTruthy();
  });

  it('shows an "Overs complete" banner instead of "All out" when the overs allotment ran out with wickets in hand', async () => {
    mockGetLiveScore.mockResolvedValue({
      match_id: 'match-1',
      overs_per_innings: 8,
      innings: {
        ...LIVE_SCORE.innings,
        total_runs: 55,
        total_wickets: 3,
        overs_completed: 8.0,
        innings_status: 'COMPLETED',
      },
    });

    const { getByTestId } = await render(<ScoringInterfaceScreen />);
    await waitFor(() => expect(getByTestId('scoring-interface-screen')).toBeTruthy());

    expect(within(getByTestId('innings-all-out-banner')).getByText(/Overs complete/)).toBeTruthy();
  });
});
