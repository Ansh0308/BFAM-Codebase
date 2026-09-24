import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getLiveScore: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const actualReact = jest.requireActual('react');
  return {
    useLocalSearchParams: () => ({ matchId: 'match-1' }),
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    // Mirrors real focus-effect semantics closely enough for a test: runs
    // once after mount via a real effect, not synchronously during render
    // (calling straight through during render causes a setState-in-render
    // infinite loop, since the real callback calls setLoading(true)).
    useFocusEffect: (cb: () => void) => actualReact.useEffect(cb, []),
  };
});

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string; bfam_id: string } }) => unknown) =>
    selector({ user: { user_id: 'organizer-user', bfam_id: 'BF-ORG' } }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;

import GameRoomScreen from '../app/(tabs)/matches/[matchId]/index';

const BASE_ROOM = {
  match_id: 'match-1',
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  match_name: 'Sunday Cricket',
  match_type: 'FRIENDS',
  ball_type: 'TENNIS',
  overs_per_innings: 6,
  scoring_mode: 'PLAYER_MANAGED',
  scheduled_start_time: '2026-09-20T10:00:00Z',
  players: [],
  attendance_summary: { confirmed: 0, maybe: 0, cant_play: 0, checked_in: 0 },
  payment: { total_due: 0, total_paid: 0, fully_paid: true },
};

// Backlog A-26: "Start Match" must not restart an already-started match —
// once match_status is IN_PROGRESS, the button becomes "Resume Match" and
// jumps straight to Scoring if an innings has begun, instead of always
// going through Intro (which used to reset the countdown for everyone).
describe('Game Room — Start/Resume Match button (backlog A-26)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Start Match" and goes to Match Setup (teams, rules) for a match that has not started', async () => {
    mockGetGameRoom.mockResolvedValue({ ...BASE_ROOM, match_status: 'CONFIRMED' });

    const { findByTestId } = await render(<GameRoomScreen />);
    const button = await findByTestId('start-match-button');

    await fireEvent.press(button);

    expect(mockGetLiveScore).not.toHaveBeenCalled();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/match-1/setup'));
  });

  it('shows "Resume Match" and jumps to Scoring when an innings is already underway', async () => {
    mockGetGameRoom.mockResolvedValue({ ...BASE_ROOM, match_status: 'IN_PROGRESS' });
    mockGetLiveScore.mockResolvedValue({
      match_id: 'match-1',
      innings: { innings_id: 'innings-1' },
    });

    const { findByTestId } = await render(<GameRoomScreen />);
    const button = await findByTestId('start-match-button');

    await fireEvent.press(button);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/match-1/scoring'));
  });

  it('shows "Resume Match" but still routes to Intro if IN_PROGRESS with no innings yet (mid-toss)', async () => {
    mockGetGameRoom.mockResolvedValue({ ...BASE_ROOM, match_status: 'IN_PROGRESS' });
    mockGetLiveScore.mockResolvedValue({ match_id: 'match-1', innings: null });

    const { findByTestId } = await render(<GameRoomScreen />);
    const button = await findByTestId('start-match-button');

    await fireEvent.press(button);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/match-1/intro'));
  });
});
