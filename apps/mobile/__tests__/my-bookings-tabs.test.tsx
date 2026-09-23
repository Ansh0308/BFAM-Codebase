import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getMyBookings: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
}));

const mockGetMyBookings = apiClient.getMyBookings as jest.Mock;

import MyBookingsScreen from '../app/(tabs)/discover/my-bookings';

const UPCOMING_BOOKING = {
  booking_id: 'b-upcoming',
  turf_name: 'BFAM Ground',
  booking_date: '2026-12-01',
  start_time: '18:00:00',
  end_time: '19:00:00',
  booking_status: 'CONFIRMED',
};
const PAST_BOOKING = {
  booking_id: 'b-past',
  turf_name: 'BFAM Ground',
  booking_date: '2025-01-01',
  start_time: '18:00:00',
  end_time: '19:00:00',
  booking_status: 'COMPLETED',
};

// Backlog A-15: split My Bookings into Upcoming/Past tabs instead of one
// long, undifferentiated list.
describe('My Bookings — Upcoming/Past tabs (backlog A-15)', () => {
  beforeEach(() => {
    mockGetMyBookings.mockReset();
  });

  it('loads the Upcoming scope by default', async () => {
    mockGetMyBookings.mockResolvedValueOnce({ results: [UPCOMING_BOOKING] });
    const { findByText } = await render(<MyBookingsScreen />);

    await findByText('BFAM Ground');
    expect(mockGetMyBookings).toHaveBeenCalledWith('upcoming');
  });

  it('switches to Past and refetches with the past scope', async () => {
    mockGetMyBookings.mockResolvedValueOnce({ results: [UPCOMING_BOOKING] });
    const { findByTestId, findByText } = await render(<MyBookingsScreen />);
    await findByText('BFAM Ground');

    mockGetMyBookings.mockResolvedValueOnce({ results: [PAST_BOOKING] });
    await fireEvent.press(await findByTestId('my-bookings-scope-past'));

    await waitFor(() => expect(mockGetMyBookings).toHaveBeenCalledWith('past'));
  });

  it('shows a scope-specific empty state', async () => {
    mockGetMyBookings.mockResolvedValueOnce({ results: [] });
    const { findByText } = await render(<MyBookingsScreen />);

    await findByText('No upcoming bookings.');
  });
});
