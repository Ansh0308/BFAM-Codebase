import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference module-scope imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn().mockResolvedValue({ sound: { replayAsync: jest.fn() } }) },
  },
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'match-1' }),
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (
    selector: (s: { user: { user_id: string; bfam_id: string; role: string } }) => unknown,
  ) => selector({ user: { user_id: 'organizer-user', bfam_id: 'BF-ORG', role: 'PLAYER' } }),
}));

const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();
const mockSocketEmit = jest.fn();
jest.mock('../src/lib/socket', () => ({
  getSocket: () => ({ on: mockSocketOn, off: mockSocketOff, emit: mockSocketEmit }),
  joinMatchRoom: jest.fn(),
  leaveMatchRoom: jest.fn(),
}));

const PLAYERS = [
  { player_id: 'p1', bfam_id: 'BF1001', participant_role: 'CAPTAIN', side_label: null },
  { player_id: 'p2', bfam_id: 'BF1002', participant_role: 'PLAYER', side_label: null },
];
const MATCH_TEAMS = [
  { match_team_id: 'mt-a', side_label: 'TEAM_A' },
  { match_team_id: 'mt-b', side_label: 'TEAM_B' },
];

const mockGetGameRoom = jest.fn();
const mockStartMatchIntro = jest.fn();
const mockGetMatchIntro = jest.fn();
const mockRecordToss = jest.fn();
const mockCompleteMatchIntro = jest.fn();
const mockGetLiveScore = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: (...args: unknown[]) => mockGetGameRoom(...args),
    startMatchIntro: (...args: unknown[]) => mockStartMatchIntro(...args),
    getMatchIntro: (...args: unknown[]) => mockGetMatchIntro(...args),
    recordToss: (...args: unknown[]) => mockRecordToss(...args),
    completeMatchIntro: (...args: unknown[]) => mockCompleteMatchIntro(...args),
    getLiveScore: (...args: unknown[]) => mockGetLiveScore(...args),
  },
}));

import MatchIntroScreen from '../app/(tabs)/matches/[matchId]/intro';

describe('Match Countdown Intro (module 2.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetGameRoom.mockResolvedValue({ organizer_id: 'organizer-user', assigned_scorer_id: null });
    mockStartMatchIntro.mockResolvedValue({
      intro: { background_music_enabled: false },
      players: PLAYERS,
      matchTeams: MATCH_TEAMS,
    });
    mockGetMatchIntro.mockResolvedValue({
      intro: { background_music_enabled: false },
      players: PLAYERS,
      matchTeams: MATCH_TEAMS,
    });
    mockRecordToss.mockResolvedValue({});
    mockCompleteMatchIntro.mockResolvedValue(undefined);
    // A-26: the screen now checks whether an innings already exists before
    // trusting COUNTDOWN as the resume point — no innings yet by default.
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires COUNTDOWN -> XI_REVEAL -> TOSS in order, with a matching Socket.IO payload at each transition', async () => {
    const { getByTestId } = await render(<MatchIntroScreen />);

    // COUNTDOWN stage: entered on mount, before the countdown even starts
    // ticking — organizer sees the big Reanimated number.
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());
    await waitFor(() =>
      expect(mockSocketEmit).toHaveBeenCalledWith('match:intro_stage', {
        matchId: 'match-1',
        stage: 'COUNTDOWN',
        data: {},
      }),
    );

    // Advance the full 10-second countdown -> auto-transition to XI_REVEAL.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());
    expect(mockSocketEmit).toHaveBeenCalledWith('match:intro_stage', {
      matchId: 'match-1',
      stage: 'XI_REVEAL',
      data: { players: PLAYERS },
    });
    expect(getByTestId('xi-player-p1')).toBeTruthy();
    expect(getByTestId('xi-player-p2')).toBeTruthy();

    // XI reveal window elapses -> auto-transition to TOSS.
    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());
    expect(mockSocketEmit).toHaveBeenCalledWith('match:intro_stage', {
      matchId: 'match-1',
      stage: 'TOSS',
      data: {},
    });

    // Stage order: exactly COUNTDOWN, then XI_REVEAL, then TOSS.
    const stageCalls = mockSocketEmit.mock.calls
      .filter(([event]) => event === 'match:intro_stage')
      .map(([, payload]) => payload.stage);
    expect(stageCalls).toEqual(['COUNTDOWN', 'XI_REVEAL', 'TOSS']);
  });

  it('records the organizer-entered toss result via the API using the real match_team_id, then hands off to Live Scoring', async () => {
    const { getByTestId } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());

    await fireEvent.press(getByTestId('toss-mode-MANUAL'));
    await fireEvent.press(getByTestId('toss-winner-TEAM_A'));
    await fireEvent.press(getByTestId('toss-decision-BAT'));
    await fireEvent.press(getByTestId('record-toss-button'));

    await waitFor(() => expect(mockRecordToss).toHaveBeenCalledWith('match-1', 'mt-a', 'BAT'));

    await fireEvent.press(getByTestId('continue-to-match'));

    await waitFor(() => expect(mockCompleteMatchIntro).toHaveBeenCalledWith('match-1'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/matches/match-1/live');
  });

  // Backlog D-3: the toss now has a reveal moment regardless of how the
  // winner was decided — this was previously coin-flip only.
  it('shows an animated winner reveal for manual toss too, and a final result reveal after recording', async () => {
    const { getByTestId, queryByTestId } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());

    await fireEvent.press(getByTestId('toss-mode-MANUAL'));
    expect(queryByTestId('manual-toss-result')).toBeNull();

    await fireEvent.press(getByTestId('toss-winner-TEAM_B'));
    expect(getByTestId('manual-toss-result')).toBeTruthy();

    await fireEvent.press(getByTestId('toss-decision-BOWL'));
    await fireEvent.press(getByTestId('record-toss-button'));

    await waitFor(() => expect(mockRecordToss).toHaveBeenCalledWith('match-1', 'mt-b', 'BOWL'));
    expect(getByTestId('toss-final-result')).toBeTruthy();
  });

  it('coin toss: the caller wins when their call matches the coin, then picks bat/bowl and it is recorded (backlog A-6)', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.1; // < 0.5 -> the coin lands HEADS

    const { getByTestId, queryByTestId } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());

    // Toss button stays disabled until a team calls and a call is chosen.
    await fireEvent.press(getByTestId('flip-coin-button'));
    await act(async () => {
      jest.advanceTimersByTime(1_400);
    });
    expect(queryByTestId('coin-flip-result')).toBeNull();

    await fireEvent.press(getByTestId('toss-caller-TEAM_A'));
    await fireEvent.press(getByTestId('toss-call-HEADS'));
    await fireEvent.press(getByTestId('flip-coin-button'));

    await act(async () => {
      jest.advanceTimersByTime(1_400);
    });
    await waitFor(() => expect(getByTestId('coin-flip-result')).toBeTruthy());

    // Called heads, coin landed heads -> the caller (Team A) won.
    await fireEvent.press(getByTestId('toss-decision-BOWL'));
    await waitFor(() => expect(mockRecordToss).toHaveBeenCalledWith('match-1', 'mt-a', 'BOWL'));
    expect(getByTestId('toss-final-result')).toBeTruthy();

    Math.random = originalRandom;
  });

  it('coin toss: the OTHER team wins when the caller calls wrong', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.9; // >= 0.5 -> TAILS

    const { getByTestId } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());

    await fireEvent.press(getByTestId('toss-caller-TEAM_A'));
    await fireEvent.press(getByTestId('toss-call-HEADS'));
    await fireEvent.press(getByTestId('flip-coin-button'));
    await act(async () => {
      jest.advanceTimersByTime(1_400);
    });
    await waitFor(() => expect(getByTestId('coin-flip-result')).toBeTruthy());

    await fireEvent.press(getByTestId('toss-decision-BAT'));
    await waitFor(() => expect(mockRecordToss).toHaveBeenCalledWith('match-1', 'mt-b', 'BAT'));

    Math.random = originalRandom;
  });

  it('the coin toss is the default and manual entry is one tap away (and back)', async () => {
    const { getByTestId, queryByTestId } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());

    expect(getByTestId('coin-flip')).toBeTruthy();
    expect(queryByTestId('toss-winner-TEAM_A')).toBeNull();

    await fireEvent.press(getByTestId('toss-mode-MANUAL'));
    expect(getByTestId('toss-winner-TEAM_A')).toBeTruthy();
    expect(queryByTestId('coin-flip')).toBeNull();

    await fireEvent.press(getByTestId('toss-mode-COIN'));
    expect(getByTestId('coin-flip')).toBeTruthy();
  });

  // Feedback: Playing XI should show real names, not BFAM IDs, and split
  // by side once sides are known.
  it('shows each player by name, split into Team A / Team B once sides are assigned', async () => {
    mockStartMatchIntro.mockResolvedValue({
      intro: { background_music_enabled: false },
      players: [
        {
          player_id: 'p1',
          bfam_id: 'BF1001',
          full_name: 'Rohan Mehta',
          participant_role: 'CAPTAIN',
          side_label: 'TEAM_A',
        },
        {
          player_id: 'p2',
          bfam_id: 'BF1002',
          full_name: 'Aditya Rathod',
          participant_role: 'PLAYER',
          side_label: 'TEAM_B',
        },
      ],
      matchTeams: MATCH_TEAMS,
    });

    const { getByTestId, getByText } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());

    expect(getByText('Rohan Mehta')).toBeTruthy();
    expect(getByText('Aditya Rathod')).toBeTruthy();
    expect(getByText('TEAM A')).toBeTruthy();
    expect(getByText('TEAM B')).toBeTruthy();
  });

  it('uses the team names set on Match Setup everywhere instead of "Team A / Team B"', async () => {
    const named = [
      { match_team_id: 'mt-a', side_label: 'TEAM_A', team_name: 'Royals' },
      { match_team_id: 'mt-b', side_label: 'TEAM_B', team_name: 'Owls' },
    ];
    mockStartMatchIntro.mockResolvedValue({
      intro: { background_music_enabled: false },
      players: [
        {
          player_id: 'p1',
          bfam_id: 'BF1',
          full_name: 'Rohan',
          participant_role: 'CAPTAIN',
          side_label: 'TEAM_A',
        },
        {
          player_id: 'p2',
          bfam_id: 'BF2',
          full_name: 'Aditya',
          participant_role: 'PLAYER',
          side_label: 'TEAM_B',
        },
      ],
      matchTeams: named,
    });

    const { getByTestId, getByText } = await render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());
    expect(getByText('ROYALS')).toBeTruthy();
    expect(getByText('OWLS')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());
    expect(getByText('Royals')).toBeTruthy(); // the caller chip
    expect(getByText('Owls')).toBeTruthy();
  });

  it('a passive (non-manager) viewer never calls the manager-only start endpoint and only mirrors broadcast stages', async () => {
    mockGetGameRoom.mockResolvedValue({ organizer_id: 'someone-else', assigned_scorer_id: null });
    const { getByTestId } = await render(<MatchIntroScreen />);

    await waitFor(() => expect(getByTestId('intro-countdown-waiting')).toBeTruthy());
    expect(mockStartMatchIntro).not.toHaveBeenCalled();
    // A passive viewer doesn't drive the timeline itself.
    expect(mockSocketEmit).not.toHaveBeenCalledWith(
      'match:intro_stage',
      expect.objectContaining({ stage: 'COUNTDOWN' }),
    );
  });
});

// Backlog A-26: "clicking Start Match again shouldn't restart the whole
// setup" — re-opening Intro (a second Start Match tap, the app
// backgrounding mid-sequence) must resume at the match's actual current
// stage, and must not re-broadcast COUNTDOWN to everyone else watching.
describe('Match Countdown Intro — resuming in place instead of restarting (backlog A-26)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetGameRoom.mockResolvedValue({ organizer_id: 'organizer-user', assigned_scorer_id: null });
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resumes at TOSS (not recorded) once Playing XI is already confirmed both sides, without re-broadcasting COUNTDOWN', async () => {
    mockStartMatchIntro.mockResolvedValue({
      intro: {
        background_music_enabled: false,
        playing_xi_confirmed_team_a: true,
        playing_xi_confirmed_team_b: true,
        toss_completed_at: null,
        toss_winner_match_team_id: null,
        toss_decision: null,
      },
      players: PLAYERS,
      matchTeams: MATCH_TEAMS,
    });

    const { getByTestId, queryByTestId } = await render(<MatchIntroScreen />);

    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());
    expect(queryByTestId('intro-countdown')).toBeNull();
    expect(queryByTestId('intro-xi-reveal')).toBeNull();
    expect(mockSocketEmit).not.toHaveBeenCalledWith(
      'match:intro_stage',
      expect.objectContaining({ stage: 'COUNTDOWN' }),
    );
  });

  it('resumes at TOSS with the result already shown once the toss is already recorded', async () => {
    mockStartMatchIntro.mockResolvedValue({
      intro: {
        background_music_enabled: false,
        playing_xi_confirmed_team_a: true,
        playing_xi_confirmed_team_b: true,
        toss_completed_at: '2026-09-20T10:00:00Z',
        toss_winner_match_team_id: 'mt-b',
        toss_decision: 'BOWL',
      },
      players: PLAYERS,
      matchTeams: MATCH_TEAMS,
    });

    const { getByTestId, getByText } = await render(<MatchIntroScreen />);

    await waitFor(() => expect(getByTestId('toss-final-result')).toBeTruthy());
    expect(getByText(/Team B won the toss, chose to bowl/)).toBeTruthy();
    expect(getByTestId('continue-to-match')).toBeTruthy();
    expect(mockSocketEmit).not.toHaveBeenCalledWith(
      'match:intro_stage',
      expect.objectContaining({ stage: 'COUNTDOWN' }),
    );
  });

  it('redirects straight to Scoring when an innings has already started, skipping the intro entirely', async () => {
    mockStartMatchIntro.mockResolvedValue({
      intro: {
        background_music_enabled: false,
        playing_xi_confirmed_team_a: true,
        playing_xi_confirmed_team_b: true,
        toss_completed_at: '2026-09-20T10:00:00Z',
        toss_winner_match_team_id: 'mt-a',
        toss_decision: 'BAT',
      },
      players: PLAYERS,
      matchTeams: MATCH_TEAMS,
    });
    mockGetLiveScore.mockResolvedValue({
      match_id: 'match-1',
      innings: { innings_id: 'innings-1' },
    });

    await render(<MatchIntroScreen />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/matches/match-1/scoring'),
    );
    expect(mockSocketEmit).not.toHaveBeenCalledWith(
      'match:intro_stage',
      expect.objectContaining({ stage: 'COUNTDOWN' }),
    );
  });

  it('still starts (and broadcasts) COUNTDOWN on an actual first start — nothing confirmed yet', async () => {
    mockStartMatchIntro.mockResolvedValue({
      intro: {
        background_music_enabled: false,
        playing_xi_confirmed_team_a: false,
        playing_xi_confirmed_team_b: false,
        toss_completed_at: null,
        toss_winner_match_team_id: null,
        toss_decision: null,
      },
      players: PLAYERS,
      matchTeams: MATCH_TEAMS,
    });

    const { getByTestId } = await render(<MatchIntroScreen />);

    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());
    await waitFor(() =>
      expect(mockSocketEmit).toHaveBeenCalledWith('match:intro_stage', {
        matchId: 'match-1',
        stage: 'COUNTDOWN',
        data: {},
      }),
    );
  });
});
