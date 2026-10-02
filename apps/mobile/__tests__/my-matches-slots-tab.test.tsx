import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyMatches: jest.fn(),
    getMyBookings: jest.fn(),
    getMyProfile: jest.fn(),
    getNotifications: jest.fn(),
    getLiveScore: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
}));

import MyMatchesScreen from '../app/(tabs)/matches/index';

const mockGetMyBookings = apiClient.getMyBookings as jest.Mock;

const booking = (id: string, date: string, status = 'CONFIRMED') => ({
  booking_id: id,
  booking_date: date,
  start_time: '18:00:00',
  end_time: '20:00:00',
  booking_status: status,
  turf_name: `Turf ${id}`,
});

// From the Matches tab the player sees their booked slots; each opens to its matches.
describe('Matches tab — Slots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getMyMatches as jest.Mock).mockResolvedValue({ results: [] });
    (apiClient.getMyProfile as jest.Mock).mockResolvedValue({ coin_balance: 0 });
    (apiClient.getNotifications as jest.Mock).mockResolvedValue({ results: [] });
  });

  it('lists confirmed slots, upcoming before ended, and leaves out cancelled bookings', async () => {
    mockGetMyBookings.mockResolvedValue({
      results: [
        booking('old', '2020-01-01'),
        booking('future', '2099-01-01'),
        booking('cancelled', '2099-02-02', 'CANCELLED'),
      ],
    });
    const { getByTestId, findByTestId, queryByTestId, getByText } = await render(
      <MyMatchesScreen />,
    );

    await fireEvent.press(getByTestId('my-matches-scope-slots'));
    expect(await findByTestId('slot-card-future')).toBeTruthy();
    expect(getByTestId('slot-card-old')).toBeTruthy();
    expect(queryByTestId('slot-card-cancelled')).toBeNull();
    expect(getByText('YOUR SLOTS')).toBeTruthy();
    expect(getByText('Ended')).toBeTruthy();
  });

  it('opens the slot when a card is tapped', async () => {
    mockGetMyBookings.mockResolvedValue({ results: [booking('future', '2099-01-01')] });
    const { getByTestId, findByTestId } = await render(<MyMatchesScreen />);

    await fireEvent.press(getByTestId('my-matches-scope-slots'));
    await fireEvent.press(await findByTestId('slot-card-future'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/matches/slot/[bookingId]',
      params: { bookingId: 'future', turfName: 'Turf future' },
    });
  });

  it('says so when there are no slots yet', async () => {
    mockGetMyBookings.mockResolvedValue({ results: [] });
    const { getByTestId, findByText } = await render(<MyMatchesScreen />);

    await fireEvent.press(getByTestId('my-matches-scope-slots'));
    expect(await findByText('NO SLOTS YET')).toBeTruthy();
  });
});
