import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getBookingDetails: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ bookingId: 'b1' }),
  // Runs the focus callback once on mount, like the real hook does for a
  // freshly-mounted screen — not on every re-render (the naive `(cb) =>
  // cb()` form re-invokes it after every setState inside `load()` itself,
  // exhausting `mockResolvedValueOnce` and crashing on the second call).
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, []),
}));

const mockGetBookingDetails = apiClient.getBookingDetails as jest.Mock;

import BookingDetails from '../app/(tabs)/discover/booking/[bookingId]/index';

const PENDING_BOOKING = {
  booking_id: 'b1',
  turf_name: 'Green Park Box Cricket',
  city: 'Rajkot',
  booking_date: '2026-09-10',
  start_time: '18:00:00',
  end_time: '19:00:00',
  booking_amount: 1000,
  payment_mode: 'UPI',
  booking_status: 'PENDING',
};

// Backlog G-23: Reschedule Booking's entry point on Booking Details.
describe('BookingDetails screen — Reschedule Booking entry point (backlog G-23)', () => {
  beforeEach(() => {
    mockGetBookingDetails.mockReset();
    mockPush.mockReset();
  });

  it('shows Reschedule and Cancel actions for a still-modifiable booking and navigates on tap', async () => {
    mockGetBookingDetails.mockResolvedValueOnce(PENDING_BOOKING);
    const { getByTestId } = await render(<BookingDetails />);

    await waitFor(() => expect(getByTestId('reschedule-booking-link')).toBeTruthy());
    expect(getByTestId('cancel-booking-link')).toBeTruthy();

    await fireEvent.press(getByTestId('reschedule-booking-link'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/booking/b1/reschedule');
  });

  it('hides Reschedule and Cancel for a completed booking', async () => {
    mockGetBookingDetails.mockResolvedValueOnce({
      ...PENDING_BOOKING,
      booking_status: 'COMPLETED',
    });
    const { queryByTestId, getByTestId } = await render(<BookingDetails />);

    await waitFor(() => expect(getByTestId('booking-details-screen')).toBeTruthy());
    expect(queryByTestId('reschedule-booking-link')).toBeNull();
    expect(queryByTestId('cancel-booking-link')).toBeNull();
  });
});
