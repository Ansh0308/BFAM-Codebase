import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getGameRoom: jest.fn(),
    getBalancedTeams: jest.fn(),
  },
}));

jest.mock('expo-router', () => {
  const actualReact = jest.requireActual('react');
  return {
    useLocalSearchParams: () => ({ matchId: 'match-1' }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (cb: () => void) => actualReact.useEffect(cb, []),
  };
});

let mockUserId = 'organizer-user';
jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string; bfam_id: string } }) => unknown) =>
    selector({ user: { user_id: mockUserId, bfam_id: 'BF-ORG' } }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockGetBalancedTeams = apiClient.getBalancedTeams as jest.Mock;

import GameRoomScreen from '../app/(tabs)/matches/[matchId]/index';

const ROOM = {
  match_id: 'match-1',
  organizer_id: 'organizer-user',
  assigned_scorer_id: null,
  match_name: 'Sunday Cricket',
  match_type: 'FRIENDS',
  ball_type: 'TENNIS',
  overs_per_innings: 6,
  scoring_mode: 'PLAYER_MANAGED',
  match_status: 'CONFIRMED',
  scheduled_start_time: '2026-09-20T10:00:00Z',
  players: [],
  attendance_summary: { confirmed: 0, maybe: 0, cant_play: 0, checked_in: 0 },
  payment: { total_due: 0, total_paid: 0, fully_paid: true },
};

// Long tail — skill-aware team balancing (PRD §12.28).
describe('Game Room — Suggest Balanced Teams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'organizer-user';
    mockGetGameRoom.mockResolvedValue(ROOM);
  });

  it('shows the two suggested sides after tapping the button', async () => {
    mockGetBalancedTeams.mockResolvedValue({
      team_a: [
        {
          player_id: 'p1',
          bfam_id: 'BF1',
          full_name: 'Asha',
          skill_rating: 700,
          playing_role: null,
        },
      ],
      team_b: [
        {
          player_id: 'p2',
          bfam_id: 'BF2',
          full_name: 'Ravi',
          skill_rating: 690,
          playing_role: null,
        },
      ],
      strength_a: 700,
      strength_b: 690,
    });
    const { findByTestId, findByText } = await render(<GameRoomScreen />);
    await fireEvent.press(await findByTestId('suggest-balanced-teams'));

    expect(mockGetBalancedTeams).toHaveBeenCalledWith('match-1');
    expect(await findByTestId('balanced-teams')).toBeTruthy();
    expect(await findByText('Asha')).toBeTruthy();
    expect(await findByText('Ravi')).toBeTruthy();
  });

  it('hides the button from non-managers', async () => {
    mockUserId = 'someone-else';
    const { findByTestId, queryByTestId } = await render(<GameRoomScreen />);
    await findByTestId('game-room-screen');
    expect(queryByTestId('suggest-balanced-teams')).toBeNull();
  });
});
