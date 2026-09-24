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
    assignPlayerSides: jest.fn(),
    setExtrasCountTowardScore: jest.fn(),
  },
}));

jest.mock('../src/lib/sounds', () => ({
  playTriggerSound: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetMatchIntro = apiClient.getMatchIntro as jest.Mock;
const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;
const mockGetScorecard = apiClient.getScorecard as jest.Mock;
const mockRecordBall = apiClient.recordBall as jest.Mock;
const mockUndoBall = apiClient.undoBall as jest.Mock;

import ScoringInterfaceScreen from '../app/(tabs)/matches/[matchId]/scoring';

// p1, p2, p4 bat for mt-a; p3 bowls for mt-b.
const ROOM = {
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  overs_per_innings: 6,
  no_non_striker: false,
  players: [
    { player_id: 'p1', bfam_id: 'BF1001', invitation_status: 'CONFIRMED', match_team_id: 'mt-a' },
    { player_id: 'p2', bfam_id: 'BF1002', invitation_status: 'CONFIRMED', match_team_id: 'mt-a' },
    { player_id: 'p3', bfam_id: 'BF1003', invitation_status: 'CONFIRMED', match_team_id: 'mt-b' },
    { player_id: 'p4', bfam_id: 'BF1004', invitation_status: 'PENDING', match_team_id: 'mt-a' },
    { player_id: 'p5', bfam_id: 'BF1005', invitation_status: 'CANT_PLAY', match_team_id: 'mt-a' },
  ],
};

const INNINGS = {
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
};

const liveWith = (
  over: Record<string, unknown> = {},
  inningsOver: Record<string, unknown> = {},
) => ({
  match_id: 'match-1',
  innings: { ...INNINGS, ...inningsOver },
  overs_per_innings: 6,
  no_non_striker: false,
  current_over_balls: [],
  last_ball: null,
  current_run_rate: 0,
  ...over,
});

const scorecardWith = (batting: unknown[] = [], bowling: unknown[] = []) => ({
  match_id: 'match-1',
  extras_count_toward_score: true,
  innings: [{ innings_id: 'innings-1', batting, bowling }],
});

type Utils = Awaited<ReturnType<typeof render>>;

async function pick(utils: Utils, sheet: string, playerId: string) {
  const option = await utils.findByTestId(`${sheet}-options-${playerId}`);
  await fireEvent.press(option);
}

// Opening prompts appear one after the other: striker -> non-striker -> bowler.
async function renderReady(opts: { single?: boolean } = {}) {
  const utils = await render(<ScoringInterfaceScreen />);
  await pick(utils, 'striker-select', 'p1');
  if (!opts.single) await pick(utils, 'non-striker-select', 'p2');
  await pick(utils, 'bowler-select', 'p3');
  await waitFor(() => expect(utils.queryByTestId('sheet-bowler-backdrop')).toBeNull());
  return utils;
}

describe('Scoring Interface (rebuilt)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetMatchIntro.mockResolvedValue(null);
    mockGetLiveScore.mockResolvedValue(liveWith());
    mockGetScorecard.mockResolvedValue(scorecardWith());
    mockRecordBall.mockResolvedValue({ event: {}, innings: INNINGS, audio_trigger: 'NONE' });
  });

  describe('asking for the right person at the right time', () => {
    it('opens the openers prompts in order on a fresh innings, offering only the batting side for batters', async () => {
      const utils = await render(<ScoringInterfaceScreen />);

      // Striker first — batting side only (p1, p2, PENDING p4), never the
      // bowling side's p3 or the CANT_PLAY p5.
      expect(await utils.findByTestId('striker-select-options-p1')).toBeTruthy();
      expect(utils.getByTestId('striker-select-options-p4')).toBeTruthy();
      expect(utils.queryByTestId('striker-select-options-p3')).toBeNull();
      expect(utils.queryByTestId('striker-select-options-p5')).toBeNull();
      await fireEvent.press(utils.getByTestId('striker-select-options-p1'));

      // Then the non-striker (not the striker again).
      expect(await utils.findByTestId('non-striker-select-options-p2')).toBeTruthy();
      expect(utils.queryByTestId('non-striker-select-options-p1')).toBeNull();
      await fireEvent.press(utils.getByTestId('non-striker-select-options-p2'));

      // Then the bowler — bowling side only.
      expect(await utils.findByTestId('bowler-select-options-p3')).toBeTruthy();
      expect(utils.queryByTestId('bowler-select-options-p1')).toBeNull();
    });

    it('will not record a ball until batters and a bowler are chosen', async () => {
      const utils = await render(<ScoringInterfaceScreen />);
      await utils.findByTestId('sheet-striker');
      await fireEvent.press(utils.getByTestId('sheet-striker-backdrop')); // dismiss
      await fireEvent.press(utils.getByTestId('run-1'));
      expect(mockRecordBall).not.toHaveBeenCalled();
      expect(utils.getByTestId('pick-players-banner')).toBeTruthy();
    });

    it('rebuilds the crease from the last ball when the screen is reopened mid-innings', async () => {
      mockGetLiveScore.mockResolvedValue(
        liveWith(
          {
            current_striker_player_id: 'p1',
            current_non_striker_player_id: 'p2',
            current_bowler_player_id: 'p3',
            last_ball: { runs_scored: 1, extra_type: 'NONE', extra_runs: 0, is_wicket: false },
          },
          { overs_completed: 0.2 },
        ),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      await waitFor(() => expect(utils.getByTestId('scoring-interface-screen')).toBeTruthy());
      // Odd run on the last ball -> they crossed: p2 is now on strike.
      await waitFor(() =>
        expect(within(utils.getByTestId('striker-select')).getByText('BF1002')).toBeTruthy(),
      );
      expect(within(utils.getByTestId('non-striker-select')).getByText('BF1001')).toBeTruthy();
      expect(within(utils.getByTestId('bowler-select')).getByText('BF1003')).toBeTruthy();
      expect(utils.queryByTestId('sheet-striker-backdrop')).toBeNull(); // nothing to ask
    });
  });

  describe('strike rotation (two-batter mode)', () => {
    it('a one-tap Swap button flips the striker and non-striker', async () => {
      const utils = await renderReady();
      await fireEvent.press(utils.getByTestId('swap-strike-button'));
      expect(within(utils.getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
      expect(within(utils.getByTestId('non-striker-select')).getByText('BF1001')).toBeTruthy();
    });

    it('automatically rotates strike after an odd-run ball', async () => {
      const utils = await renderReady();
      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-1'));
      });
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(within(utils.getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
    });

    it('does not rotate strike after an even-run ball', async () => {
      const utils = await renderReady();
      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-4'));
      });
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(within(utils.getByTestId('striker-select')).getByText('BF1001')).toBeTruthy();
    });

    it('counts the runs run on top of a wide when deciding whether to rotate', async () => {
      const utils = await renderReady();
      await fireEvent.press(utils.getByTestId('extra-WIDE'));
      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-1'));
      });
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      // wide + 1 run: wd carries an automatic 1, so extra_runs = 2 (one run run).
      expect(mockRecordBall.mock.calls[0][1]).toMatchObject({
        runs_scored: 0,
        extra_type: 'WIDE',
        extra_runs: 2,
      });
      expect(within(utils.getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
    });

    it('changes ends at the end of an over and asks who bowls next, flagging the last bowler', async () => {
      const utils = await renderReady();
      mockRecordBall.mockResolvedValue({
        event: {},
        innings: { ...INNINGS, overs_completed: 1 },
        audio_trigger: 'NONE',
      });
      mockGetLiveScore.mockResolvedValue(liveWith({}, { overs_completed: 1 }));

      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-0'));
      });
      // Dot ball ended the over: ends swap and the bowler slot is cleared...
      expect(await utils.findByTestId('bowler-select-options-p3')).toBeTruthy();
      expect(within(utils.getByTestId('striker-select')).getByText('BF1002')).toBeTruthy();
      // ...with the bowler who just bowled flagged.
      expect(utils.getByText('Bowled the last over')).toBeTruthy();
    });
  });

  describe('wickets', () => {
    it('one tap on a dismissal type records it against the striker — no separate confirm step', async () => {
      const utils = await renderReady();
      mockGetLiveScore.mockResolvedValue(liveWith({}, { total_wickets: 1 }));
      mockGetScorecard.mockResolvedValue(
        scorecardWith([{ player_id: 'p1', runs: 0, balls: 1, fours: 0, sixes: 0, out: true }]),
      );

      await fireEvent.press(utils.getByTestId('wicket-button'));
      await fireEvent.press(await utils.findByTestId('wicket-type-BOWLED'));

      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(mockRecordBall.mock.calls[0][1]).toMatchObject({
        striker_player_id: 'p1',
        is_wicket: true,
        wicket_type: 'BOWLED',
        dismissed_player_id: 'p1',
      });
    });

    it('a lone remaining batter walks in without being asked', async () => {
      const utils = await renderReady();
      mockGetLiveScore.mockResolvedValue(liveWith({}, { total_wickets: 1 }));
      mockGetScorecard.mockResolvedValue(
        scorecardWith([{ player_id: 'p1', runs: 0, balls: 1, fours: 0, sixes: 0, out: true }]),
      );

      await fireEvent.press(utils.getByTestId('wicket-button'));
      await fireEvent.press(await utils.findByTestId('wicket-type-BOWLED'));

      // Batting side is p1(out), p2(at the crease), p4 -> only p4 is left.
      await waitFor(() =>
        expect(within(utils.getByTestId('striker-select')).getByText('BF1004')).toBeTruthy(),
      );
      expect(utils.queryByTestId('striker-select-options-p4')).toBeNull();
    });

    it('asks "Who\'s coming in?" when more than one batter is left, never offering the dismissed one', async () => {
      mockGetGameRoom.mockResolvedValue({
        ...ROOM,
        players: [
          ...ROOM.players,
          {
            player_id: 'p6',
            bfam_id: 'BF1006',
            invitation_status: 'CONFIRMED',
            match_team_id: 'mt-a',
          },
        ],
      });
      const utils = await renderReady();
      mockGetLiveScore.mockResolvedValue(liveWith({}, { total_wickets: 1 }));
      mockGetScorecard.mockResolvedValue(
        scorecardWith([{ player_id: 'p1', runs: 0, balls: 1, fours: 0, sixes: 0, out: true }]),
      );

      await fireEvent.press(utils.getByTestId('wicket-button'));
      await fireEvent.press(await utils.findByTestId('wicket-type-BOWLED'));

      expect(await utils.findByTestId('striker-select-options-p4')).toBeTruthy();
      expect(utils.getByTestId('striker-select-options-p6')).toBeTruthy();
      expect(utils.queryByTestId('striker-select-options-p1')).toBeNull(); // out
      expect(utils.queryByTestId('striker-select-options-p2')).toBeNull(); // at the crease
      expect(utils.getByText("Who's coming in?")).toBeTruthy();
    });

    it('asks which end was run out and dismisses that batter, not always the striker', async () => {
      const utils = await renderReady();
      await fireEvent.press(utils.getByTestId('wicket-button'));
      await fireEvent.press(await utils.findByTestId('wicket-type-RUN_OUT'));
      expect(mockRecordBall).not.toHaveBeenCalled();

      await fireEvent.press(await utils.findByTestId('run-out-dismissed-p2'));
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(mockRecordBall.mock.calls[0][1]).toMatchObject({
        wicket_type: 'RUN_OUT',
        dismissed_player_id: 'p2',
      });
    });
  });

  describe('single-batter (box cricket) mode', () => {
    beforeEach(() => {
      mockGetLiveScore.mockResolvedValue(liveWith({ no_non_striker: true }));
    });

    it('has no non-striker, never asks for one, and sends none with the ball', async () => {
      const utils = await renderReady({ single: true });
      expect(utils.queryByTestId('non-striker-select')).toBeNull();
      expect(utils.queryByTestId('swap-strike-button')).toBeNull();

      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-1'));
      });
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(mockRecordBall.mock.calls[0][1]).toMatchObject({
        striker_player_id: 'p1',
        non_striker_player_id: null,
      });
    });

    it('does not rotate on odd runs or at the end of an over', async () => {
      const utils = await renderReady({ single: true });
      mockRecordBall.mockResolvedValue({
        event: {},
        innings: { ...INNINGS, overs_completed: 1 },
        audio_trigger: 'NONE',
      });
      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-1'));
      });
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(within(utils.getByTestId('striker-select')).getByText('BF1001')).toBeTruthy();
    });

    it('a wicket clears the striker and the next batter takes strike', async () => {
      const utils = await renderReady({ single: true });
      mockGetLiveScore.mockResolvedValue(liveWith({ no_non_striker: true }, { total_wickets: 1 }));
      mockGetScorecard.mockResolvedValue(
        scorecardWith([{ player_id: 'p1', runs: 3, balls: 2, fours: 0, sixes: 0, out: true }]),
      );

      await fireEvent.press(utils.getByTestId('wicket-button'));
      // A run-out in single-batter mode has only one possible batter: no "who".
      await fireEvent.press(await utils.findByTestId('wicket-type-RUN_OUT'));
      await waitFor(() => expect(mockRecordBall).toHaveBeenCalled());
      expect(mockRecordBall.mock.calls[0][1]).toMatchObject({
        wicket_type: 'RUN_OUT',
        dismissed_player_id: 'p1',
      });
      // p2 and p4 are left -> asked who's coming in.
      expect(await utils.findByTestId('striker-select-options-p2')).toBeTruthy();
      expect(utils.getByTestId('striker-select-options-p4')).toBeTruthy();
    });
  });

  describe('header and over display', () => {
    it("shows this over's balls (extras and wickets included) and empty slots for the rest", async () => {
      mockGetLiveScore.mockResolvedValue(
        liveWith(
          {
            current_striker_player_id: 'p1',
            current_non_striker_player_id: 'p2',
            current_bowler_player_id: 'p3',
            current_over_balls: [
              { runs_scored: 1, extra_type: 'NONE', extra_runs: 0, is_wicket: false },
              { runs_scored: 0, extra_type: 'WIDE', extra_runs: 1, is_wicket: false },
              { runs_scored: 6, extra_type: 'NONE', extra_runs: 0, is_wicket: false },
            ],
            last_ball: { runs_scored: 6, extra_type: 'NONE', extra_runs: 0, is_wicket: false },
          },
          { total_runs: 8, overs_completed: 0.2 },
        ),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      await waitFor(() => expect(utils.getByTestId('over-ball-0')).toBeTruthy());
      expect(within(utils.getByTestId('over-ball-0')).getByText('1')).toBeTruthy();
      expect(within(utils.getByTestId('over-ball-1')).getByText('wd')).toBeTruthy();
      expect(within(utils.getByTestId('over-ball-2')).getByText('6')).toBeTruthy();
      // 2 legal balls so far -> 4 empty slots.
      expect(utils.getByTestId('over-dot-3')).toBeTruthy();
      expect(utils.queryByTestId('over-dot-4')).toBeNull();
    });

    it('names the batting team and shows the chase requirement in the second innings', async () => {
      mockGetMatchIntro.mockResolvedValue({
        intro: { background_music_enabled: false },
        matchTeams: [
          { match_team_id: 'mt-a', side_label: 'TEAM_A', team_name: 'Royals' },
          { match_team_id: 'mt-b', side_label: 'TEAM_B', team_name: 'Owls' },
        ],
      });
      mockGetLiveScore.mockResolvedValue(
        liveWith(
          {},
          {
            innings_number: 2,
            batting_match_team_id: 'mt-b',
            bowling_match_team_id: 'mt-a',
            total_runs: 20,
            target_runs: 51,
            overs_completed: 1,
          },
        ),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      expect((await utils.findByTestId('batting-team-name')).props.children).toBe('OWLS');
      expect(utils.getByTestId('chase-need').props.children).toBe('31 off 30');
    });
  });

  describe('undo', () => {
    it('puts the crease back exactly as it was before the undone ball', async () => {
      const utils = await renderReady();
      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-1')); // rotates: p2 on strike
      });
      await waitFor(() =>
        expect(within(utils.getByTestId('striker-select')).getByText('BF1002')).toBeTruthy(),
      );

      mockUndoBall.mockResolvedValue({
        undone_event_id: 'e1',
        innings: INNINGS,
        undone_event: {
          striker_player_id: 'p1',
          non_striker_player_id: 'p2',
          bowler_player_id: 'p3',
        },
      });
      await act(async () => {
        await fireEvent.press(utils.getByTestId('undo-button'));
      });
      await waitFor(() =>
        expect(within(utils.getByTestId('striker-select')).getByText('BF1001')).toBeTruthy(),
      );
    });
  });

  describe('starting the next innings', () => {
    it('closes an open picker and asks for the new innings’ striker first', async () => {
      const utils = await renderReady();
      mockRecordBall.mockResolvedValue({
        event: {},
        innings: { ...INNINGS, overs_completed: 1 },
        audio_trigger: 'NONE',
      });
      mockGetLiveScore.mockResolvedValue(liveWith({}, { overs_completed: 1 }));
      await act(async () => {
        await fireEvent.press(utils.getByTestId('run-0'));
      });
      // The end-of-over "who's bowling?" prompt is open...
      expect(await utils.findByTestId('bowler-select-options-p3')).toBeTruthy();

      // ...then the scorer ends the innings from behind it.
      (apiClient.startInnings as jest.Mock).mockResolvedValue({});
      mockGetLiveScore.mockResolvedValue(
        liveWith(
          {},
          {
            innings_id: 'innings-2',
            innings_number: 2,
            batting_match_team_id: 'mt-b',
            bowling_match_team_id: 'mt-a',
            target_runs: 1,
          },
        ),
      );
      await act(async () => {
        await fireEvent.press(utils.getByTestId('end-innings-button'));
      });

      // Batting order of prompts restarts at the striker (p3 bats for mt-b).
      expect(await utils.findByTestId('striker-select-options-p3')).toBeTruthy();
      expect(utils.queryByTestId('bowler-select-options-p3')).toBeNull();
    });
  });

  describe('innings and match end', () => {
    it('shows the all-out banner and hides the run/wicket controls once the innings is completed', async () => {
      mockGetLiveScore.mockResolvedValue(
        liveWith({}, { innings_status: 'COMPLETED', total_wickets: 3, overs_completed: 2 }),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      expect(await utils.findByTestId('innings-all-out-banner')).toBeTruthy();
      expect(utils.queryByTestId('run-1')).toBeNull();
      expect(utils.queryByTestId('wicket-button')).toBeNull();
      expect(utils.getByText('Start 2nd Innings')).toBeTruthy();
    });

    it('explains a chased target instead of "all out"', async () => {
      mockGetLiveScore.mockResolvedValue(
        liveWith(
          {},
          {
            innings_number: 2,
            innings_status: 'COMPLETED',
            total_runs: 60,
            total_wickets: 2,
            target_runs: 51,
            overs_completed: 3,
          },
        ),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      expect(await utils.findByText('Target chased — 60/2')).toBeTruthy();
    });

    it('explains used-up overs instead of "all out"', async () => {
      mockGetLiveScore.mockResolvedValue(
        liveWith(
          {},
          { innings_status: 'COMPLETED', total_runs: 40, total_wickets: 2, overs_completed: 6 },
        ),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      expect(await utils.findByText('Overs complete — 40/2')).toBeTruthy();
    });

    it('Finish Match goes straight to the (automatic) result screen', async () => {
      mockGetLiveScore.mockResolvedValue(
        liveWith({}, { innings_number: 2, innings_status: 'COMPLETED', target_runs: 51 }),
      );
      const utils = await render(<ScoringInterfaceScreen />);
      await fireEvent.press(await utils.findByTestId('finish-match-button'));
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/match-1/result');
    });
  });
});

describe('Scoring Interface — starting the first innings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });
    mockGetScorecard.mockResolvedValue(scorecardWith());
    (apiClient.startInnings as jest.Mock).mockResolvedValue({});
  });

  it('pre-selects who bats from the toss and starts the innings with those sides — no side assignment step', async () => {
    mockGetMatchIntro.mockResolvedValue({
      intro: {
        background_music_enabled: false,
        toss_winner_match_team_id: 'mt-b',
        toss_decision: 'BOWL',
        toss_completed_at: 'now',
      },
      matchTeams: [
        { match_team_id: 'mt-a', side_label: 'TEAM_A', team_name: 'Royals' },
        { match_team_id: 'mt-b', side_label: 'TEAM_B', team_name: 'Owls' },
      ],
    });
    const utils = await render(<ScoringInterfaceScreen />);
    expect(await utils.findByTestId('start-innings-screen')).toBeTruthy();
    expect(utils.getByText('Royals')).toBeTruthy();
    expect(utils.queryByTestId('legacy-sides')).toBeNull();

    // Owls won the toss and chose to bowl -> Royals bat first.
    await fireEvent.press(utils.getByTestId('start-innings-button'));
    await waitFor(() =>
      expect(apiClient.startInnings).toHaveBeenCalledWith('match-1', {
        innings_number: 1,
        batting_match_team_id: 'mt-a',
        bowling_match_team_id: 'mt-b',
        target_runs: null,
      }),
    );
    expect(apiClient.assignPlayerSides).not.toHaveBeenCalled();
    expect(apiClient.setExtrasCountTowardScore).not.toHaveBeenCalled();
  });
});
