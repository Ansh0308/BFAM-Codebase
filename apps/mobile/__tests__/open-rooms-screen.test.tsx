import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getOpenRooms: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
}));

const mockGetOpenRooms = apiClient.getOpenRooms as jest.Mock;

import OpenRoomsScreen from '../app/(tabs)/matches/rooms/index';

const ROOM = {
  room_id: 'r1',
  room_name: 'BFAM Warriors',
  captain_user_id: 'u1',
  ball_type: 'TENNIS',
  overs_per_innings: 6,
  max_players: 10,
  room_status: 'FILLING',
  match_id: null,
  player_count: 6,
};

// Presentation redesign of Backlog B-11's discovery screen — same list, same
// Create a Room action, same tap-a-room navigation.
describe('Find a Room screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the hero copy and routes Create a Room to the create screen', async () => {
    mockGetOpenRooms.mockResolvedValueOnce({ results: [] });
    const { findByText, findByTestId } = await render(<OpenRoomsScreen />);

    await findByText('Join a lobby other players are assembling, or start your own.');
    await fireEvent.press(await findByTestId('create-room-button'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/rooms/create');
  });

  it('shows the empty state when no rooms are open', async () => {
    mockGetOpenRooms.mockResolvedValueOnce({ results: [] });
    const { findByText } = await render(<OpenRoomsScreen />);

    await findByText('NO OPEN ROOMS RIGHT NOW');
    await findByText('Start a room and get players together!');
  });

  it('lists open rooms with players, overs and an OPEN status, and opens one on tap', async () => {
    mockGetOpenRooms.mockResolvedValueOnce({ results: [ROOM] });
    const { findByText, findByTestId } = await render(<OpenRoomsScreen />);

    await findByText('BFAM Warriors');
    await findByText('6 / 10 PLAYERS');
    await findByText('6 OVERS • TENNIS');
    await findByText('OPEN');
    await findByText('1 Room');

    await fireEvent.press(await findByTestId('room-row-r1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/rooms/r1');
  });

  it('flags a room with a single seat left', async () => {
    mockGetOpenRooms.mockResolvedValueOnce({ results: [{ ...ROOM, player_count: 9 }] });
    const { findByText } = await render(<OpenRoomsScreen />);

    await findByText('1 SPOT LEFT');
  });
});
