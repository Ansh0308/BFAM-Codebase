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
const mockRecordToss = jest.fn();
const mockCompleteMatchIntro = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: (...args: unknown[]) => mockGetGameRoom(...args),
    startMatchIntro: (...args: unknown[]) => mockStartMatchIntro(...args),
    getMatchIntro: jest.fn(),
    recordToss: (...args: unknown[]) => mockRecordToss(...args),
    completeMatchIntro: (...args: unknown[]) => mockCompleteMatchIntro(...args),
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
    mockRecordToss.mockResolvedValue({});
    mockCompleteMatchIntro.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires COUNTDOWN -> XI_REVEAL -> TOSS in order, with a matching Socket.IO payload at each transition', async () => {
    const { getByTestId } = render(<MatchIntroScreen />);

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
    const { getByTestId } = render(<MatchIntroScreen />);
    await waitFor(() => expect(getByTestId('intro-countdown')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(getByTestId('intro-xi-reveal')).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    await waitFor(() => expect(getByTestId('intro-toss')).toBeTruthy());

    fireEvent.press(getByTestId('toss-winner-TEAM_A'));
    fireEvent.press(getByTestId('toss-decision-BAT'));
    fireEvent.press(getByTestId('record-toss-button'));

    await waitFor(() => expect(mockRecordToss).toHaveBeenCalledWith('match-1', 'mt-a', 'BAT'));

    fireEvent.press(getByTestId('continue-to-match'));

    await waitFor(() => expect(mockCompleteMatchIntro).toHaveBeenCalledWith('match-1'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/matches/match-1/live-stub');
  });

  it('a passive (non-manager) viewer never calls the manager-only start endpoint and only mirrors broadcast stages', async () => {
    mockGetGameRoom.mockResolvedValue({ organizer_id: 'someone-else', assigned_scorer_id: null });
    const { getByTestId } = render(<MatchIntroScreen />);

    await waitFor(() => expect(getByTestId('intro-countdown-waiting')).toBeTruthy());
    expect(mockStartMatchIntro).not.toHaveBeenCalled();
    // A passive viewer doesn't drive the timeline itself.
    expect(mockSocketEmit).not.toHaveBeenCalledWith(
      'match:intro_stage',
      expect.objectContaining({ stage: 'COUNTDOWN' }),
    );
  });
});
