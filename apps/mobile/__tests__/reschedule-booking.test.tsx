import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getBookingDetails: jest.fn(),
    getTurfAvailability: jest.fn(),
    rescheduleBooking: jest.fn(),
  },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ bookingId: 'b1' }),
}));

const mockGetBookingDetails = apiClient.getBookingDetails as jest.Mock;
const mockGetAvailability = apiClient.getTurfAvailability as jest.Mock;
const mockRescheduleBooking = apiClient.rescheduleBooking as jest.Mock;

import RescheduleBooking from '../app/(tabs)/discover/booking/[bookingId]/reschedule';

const SAMPLE_BOOKING = { booking_id: 'b1', turf_id: 't1', booking_date: '2026-09-10' };

const SAMPLE_AVAILABILITY = {
  turf_id: 't1',
  date: '2026-09-10',
  day_type: 'WEEKDAY' as const,
  slots: [
    {
      start_time: '18:00:00',
      end_time: '19:00:00',
      status: 'AVAILABLE' as const,
      price_per_hour: 1000,
    },
    {
      start_time: '19:00:00',
      end_time: '20:00:00',
      status: 'BOOKED' as const,
      price_per_hour: 1000,
    },
  ],
};

describe('RescheduleBooking screen (backlog G-23)', () => {
  beforeEach(() => {
    mockGetBookingDetails.mockReset();
    mockGetAvailability.mockReset();
    mockRescheduleBooking.mockReset();
    mockReplace.mockReset();
    mockGetBookingDetails.mockResolvedValue(SAMPLE_BOOKING);
  });

  it("loads the booking's turf availability and lets the player pick a new slot", async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    const { getByTestId } = await render(<RescheduleBooking />);

    await waitFor(() => expect(mockGetAvailability).toHaveBeenCalledWith('t1', expect.any(String)));
    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
  });

  it('reschedules to the selected slot and returns to Booking Details on success', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    mockRescheduleBooking.mockResolvedValueOnce({ booking_id: 'b2' });

    const { getByTestId } = await render(<RescheduleBooking />);
    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    await fireEvent.press(getByTestId('slot-18:00:00'));
    await waitFor(() => expect(getByTestId('confirm-reschedule-button')).toBeTruthy());
    await fireEvent.press(getByTestId('confirm-reschedule-button'));

    await waitFor(() =>
      expect(mockRescheduleBooking).toHaveBeenCalledWith('b1', {
        booking_date: expect.any(String),
        start_time: '18:00:00',
        duration_minutes: 60,
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/discover/booking/b1');
  });

  it('shows the backend error and refreshes the grid on a 409 conflict', async () => {
    mockGetAvailability.mockResolvedValue(SAMPLE_AVAILABILITY);
    mockRescheduleBooking.mockRejectedValueOnce(
      new BFAMApiError('This slot is no longer available. Please choose another time.', 409),
    );

    const { getByTestId } = await render(<RescheduleBooking />);
    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    await fireEvent.press(getByTestId('slot-18:00:00'));
    await waitFor(() => expect(getByTestId('confirm-reschedule-button')).toBeTruthy());
    await fireEvent.press(getByTestId('confirm-reschedule-button'));

    await waitFor(() =>
      expect(getByTestId('reschedule-error-message').props.children).toBe(
        'This slot is no longer available. Please choose another time.',
      ),
    );
    expect(mockGetAvailability).toHaveBeenCalledTimes(2);
  });
});
