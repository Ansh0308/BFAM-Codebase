import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getMatchIntro: jest.fn(),
    getLiveScore: jest.fn(),
    getScorecard: jest.fn(),
    getMatchResult: jest.fn(),
    startMatchIntro: jest.fn(),
    recordToss: jest.fn(),
    setExtrasCountTowardScore: jest.fn(),
    startInnings: jest.fn(),
    recordBall: jest.fn(),
    undoBall: jest.fn(),
    finalizeMatch: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import { ScoringConsole } from '../src/components/scoring/ScoringConsole';

const api = apiClient as unknown as Record<string, jest.Mock>;

const TEAMS = [
  { match_team_id: 'ta', side_label: 'TEAM_A', team_name: 'Reds' },
  { match_team_id: 'tb', side_label: 'TEAM_B', team_name: 'Blacks' },
];
const player = (id: string, team: string | null, name: string) => ({
  match_player_id: `mp-${id}`,
  match_id: 'm1',
  player_id: id,
  match_team_id: team,
  participant_role: 'PLAYER',
  invitation_status: 'CONFIRMED',
  attendance_status: 'CHECKED_IN',
  checked_in_at: null,
  added_at: '',
  bfam_id: `BF${id}`,
  full_name: name,
});
const room = (over: Record<string, unknown> = {}) => ({
  match_id: 'm1',
  match_name: 'Sunday Smash',
  match_status: 'IN_PROGRESS',
  overs_per_innings: 6,
  no_non_striker: false,
  players: [
    player('p1', 'ta', 'Asha'),
    player('p2', 'ta', 'Bhavin'),
    player('p3', 'tb', 'Chirag'),
    player('p4', 'tb', 'Dev'),
  ],
  match_teams: TEAMS,
  ...over,
});
const innings = (over: Record<string, unknown> = {}) => ({
  innings_id: 'i1',
  match_id: 'm1',
  innings_number: 1,
  batting_match_team_id: 'ta',
  bowling_match_team_id: 'tb',
  total_runs: 0,
  total_wickets: 0,
  overs_completed: 0,
  innings_status: 'IN_PROGRESS',
  target_runs: null,
  ...over,
});
const liveWith = (inn: ReturnType<typeof innings> | null, extra: Record<string, unknown> = {}) => ({
  match_id: 'm1',
  innings: inn,
  overs_per_innings: 6,
  current_run_rate: 0,
  current_over_balls: [],
  ...extra,
});
const intro = (over: Record<string, unknown> = {}) => ({
  intro: {
    intro_id: 'x',
    match_id: 'm1',
    toss_winner_match_team_id: null,
    toss_decision: null,
    background_music_enabled: true,
    ...over,
  },
  players: [],
  matchTeams: TEAMS,
});
const scorecard = {
  match_id: 'm1',
  extras_count_toward_score: true,
  innings: [{ innings_id: 'i1', batting: [], bowling: [] }],
};
const ballResult = (over: Record<string, unknown> = {}) => ({
  event: {},
  innings: innings({ overs_completed: 0.1, ...over }),
  audio_trigger: 'NONE',
});

function setup(
  roomOver: Record<string, unknown>,
  live: ReturnType<typeof liveWith>,
  introOver?: Record<string, unknown> | null,
) {
  api.getGameRoom.mockResolvedValue(room(roomOver));
  api.getMatchIntro.mockResolvedValue(introOver === null ? undefined : intro(introOver));
  if (introOver === null) api.getMatchIntro.mockRejectedValue(new Error('no intro'));
  api.getLiveScore.mockResolvedValue(live);
  api.getScorecard.mockResolvedValue(scorecard);
}

// Opens the pickers in the order the console asks: striker, non-striker, bowler.
async function chooseOpeners() {
  fireEvent.click(await screen.findByTestId('pick-p1'));
  fireEvent.click(await screen.findByTestId('pick-p2'));
  fireEvent.click(await screen.findByTestId('pick-p3'));
}

describe('Web live-scoring console', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('begins the match, then starts the first innings from the toss result', async () => {
    setup({ match_status: 'CONFIRMED' }, liveWith(null), null);
    api.startMatchIntro.mockResolvedValue({});
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);

    fireEvent.click(await screen.findByTestId('begin-match'));
    await waitFor(() => expect(api.startMatchIntro).toHaveBeenCalledWith('m1'));
  });

  it('records the toss and prefills who bats', async () => {
    setup({}, liveWith(null), {});
    api.recordToss.mockResolvedValue({});
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);

    fireEvent.click(await screen.findByTestId('toss-winner-TEAM_B'));
    fireEvent.click(screen.getByTestId('toss-bowl'));
    fireEvent.click(screen.getByTestId('save-toss'));
    await waitFor(() => expect(api.recordToss).toHaveBeenCalledWith('m1', 'tb', 'BOWL'));
  });

  it('starts innings 1 with the chosen batting side', async () => {
    setup({}, liveWith(null), { toss_winner_match_team_id: 'ta', toss_decision: 'BAT' });
    api.setExtrasCountTowardScore.mockResolvedValue({});
    api.startInnings.mockResolvedValue(innings());
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);

    const start = await screen.findByTestId('start-innings');
    await waitFor(() => expect(start).not.toBeDisabled());
    fireEvent.click(start);
    await waitFor(() =>
      expect(api.startInnings).toHaveBeenCalledWith('m1', {
        innings_number: 1,
        batting_match_team_id: 'ta',
        bowling_match_team_id: 'tb',
        target_runs: null,
      }),
    );
  });

  it('blocks scoring until every player has a side', async () => {
    setup({ players: [player('p1', null, 'Asha'), player('p3', 'tb', 'Chirag')] }, liveWith(null), {
      toss_winner_match_team_id: 'ta',
      toss_decision: 'BAT',
    });
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    expect(await screen.findByTestId('sides-warning')).toBeInTheDocument();
    expect(screen.getByTestId('start-innings')).toBeDisabled();
  });

  it('asks for the openers, then records a four and keeps the batter on strike', async () => {
    setup({}, liveWith(innings()), {});
    api.recordBall.mockResolvedValue(ballResult({ total_runs: 4 }));
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);

    await chooseOpeners();
    await waitFor(() => expect(screen.getByTestId('run-4')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('run-4'));

    await waitFor(() =>
      expect(api.recordBall).toHaveBeenCalledWith('i1', {
        striker_player_id: 'p1',
        non_striker_player_id: 'p2',
        bowler_player_id: 'p3',
        runs_scored: 4,
        extra_type: 'NONE',
        extra_runs: 0,
        is_wicket: false,
      }),
    );

    // Four runs: no strike change, so the next ball is still p1's.
    await waitFor(() => expect(screen.getByTestId('run-1')).not.toBeDisabled());
    api.recordBall.mockResolvedValue(ballResult({ total_runs: 5 }));
    fireEvent.click(screen.getByTestId('run-1'));
    await waitFor(() => expect(api.recordBall).toHaveBeenCalledTimes(2));
    expect(api.recordBall.mock.calls[1][1].striker_player_id).toBe('p1');

    // A single changes ends: the next ball is p2's.
    await waitFor(() => expect(screen.getByTestId('run-0')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('run-0'));
    await waitFor(() => expect(api.recordBall).toHaveBeenCalledTimes(3));
    expect(api.recordBall.mock.calls[2][1].striker_player_id).toBe('p2');
  });

  it('adds the automatic run to a wide', async () => {
    setup({}, liveWith(innings()), {});
    api.recordBall.mockResolvedValue(ballResult());
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    await chooseOpeners();
    await waitFor(() => expect(screen.getByTestId('run-0')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('extra-WIDE'));
    fireEvent.click(screen.getByTestId('run-0'));
    await waitFor(() =>
      expect(api.recordBall).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ runs_scored: 0, extra_type: 'WIDE', extra_runs: 1 }),
      ),
    );
  });

  it('records a wicket for the striker', async () => {
    setup({}, liveWith(innings()), {});
    api.recordBall.mockResolvedValue(ballResult({ total_wickets: 1 }));
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    await chooseOpeners();
    await waitFor(() => expect(screen.getByTestId('wicket-button')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('wicket-button'));
    fireEvent.click(await screen.findByTestId('wicket-BOWLED'));
    await waitFor(() =>
      expect(api.recordBall).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({
          is_wicket: true,
          wicket_type: 'BOWLED',
          dismissed_player_id: 'p1',
        }),
      ),
    );
  });

  it('asks who was out on a run out', async () => {
    setup({}, liveWith(innings()), {});
    api.recordBall.mockResolvedValue(ballResult({ total_wickets: 1 }));
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    await chooseOpeners();
    await waitFor(() => expect(screen.getByTestId('wicket-button')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('wicket-button'));
    fireEvent.click(await screen.findByTestId('wicket-RUN_OUT'));
    fireEvent.click(await screen.findByTestId('runout-p2'));
    await waitFor(() =>
      expect(api.recordBall).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ wicket_type: 'RUN_OUT', dismissed_player_id: 'p2' }),
      ),
    );
  });

  it('undoes the last ball', async () => {
    setup({}, liveWith(innings()), {});
    api.undoBall.mockResolvedValue({
      undone_event_id: 'e1',
      innings: innings(),
      undone_event: {
        striker_player_id: 'p1',
        non_striker_player_id: 'p2',
        bowler_player_id: 'p3',
      },
    });
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    await chooseOpeners();
    fireEvent.click(await screen.findByTestId('undo-ball'));
    await waitFor(() => expect(api.undoBall).toHaveBeenCalledWith('i1'));
  });

  it('runs a ball from the keyboard', async () => {
    setup({}, liveWith(innings()), {});
    api.recordBall.mockResolvedValue(ballResult());
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    await chooseOpeners();
    await waitFor(() => expect(screen.getByTestId('run-6')).not.toBeDisabled());

    fireEvent.keyDown(window, { key: '6' });
    await waitFor(() =>
      expect(api.recordBall).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ runs_scored: 6 }),
      ),
    );
  });

  it('offers the chase and finishing once an innings is complete', async () => {
    setup(
      {},
      liveWith(
        innings({
          innings_status: 'COMPLETED',
          total_runs: 42,
          total_wickets: 3,
          overs_completed: 6,
        }),
      ),
      {},
    );
    api.startInnings.mockResolvedValue(innings({ innings_number: 2 }));
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);

    expect(await screen.findByTestId('innings-complete')).toHaveTextContent(
      /Overs complete — 42\/3/,
    );
    fireEvent.click(screen.getByTestId('start-next-innings'));
    await waitFor(() =>
      expect(api.startInnings).toHaveBeenCalledWith('m1', {
        innings_number: 2,
        batting_match_team_id: 'tb',
        bowling_match_team_id: 'ta',
        target_runs: 43,
      }),
    );
  });

  it('finishes the match after confirmation', async () => {
    setup(
      {},
      liveWith(
        innings({
          innings_number: 2,
          innings_status: 'COMPLETED',
          total_runs: 30,
          target_runs: 43,
          overs_completed: 6,
        }),
      ),
      {},
    );
    api.finalizeMatch.mockResolvedValue({ result_id: 'r1' });
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);

    fireEvent.click(await screen.findByTestId('finish-match'));
    expect(api.finalizeMatch).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.finalizeMatch).toHaveBeenCalledWith('m1', {}));
  });

  it('shows the result of a finished match', async () => {
    setup({ match_status: 'COMPLETED' }, liveWith(innings({ innings_status: 'COMPLETED' })), {});
    api.getMatchResult.mockResolvedValue({
      result_type: 'WIN',
      winning_team_name: 'Reds',
      winning_margin: 'by 12 runs',
      player_of_the_match_name: 'Asha',
    });
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    expect(await screen.findByText('Reds won')).toBeInTheDocument();
    expect(screen.getByText('by 12 runs')).toBeInTheDocument();
  });

  it('explains when the match cannot be opened', async () => {
    api.getGameRoom.mockRejectedValue(new Error('403'));
    api.getMatchIntro.mockResolvedValue(undefined);
    api.getLiveScore.mockRejectedValue(new Error('403'));
    api.getScorecard.mockResolvedValue(null);
    render(<ScoringConsole matchId="m1" backHref="/owner/matches" />);
    expect(await screen.findByTestId('scoring-error')).toBeInTheDocument();
  });
});
