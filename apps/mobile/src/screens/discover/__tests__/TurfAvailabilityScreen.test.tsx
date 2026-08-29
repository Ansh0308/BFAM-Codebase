import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TurfAvailabilityScreen } from '../TurfAvailabilityScreen';
import { apiClient } from '../../../lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../../../lib/apiClient', () => ({
  apiClient: { getTurfAvailability: jest.fn(), createBooking: jest.fn() },
}));

const mockGetAvailability = apiClient.getTurfAvailability as jest.Mock;
const mockCreateBooking = apiClient.createBooking as jest.Mock;

function renderScreen() {
  const navigation = { navigate: jest.fn(), replace: jest.fn() };
  const route = {
    key: 'TurfAvailability',
    name: 'TurfAvailability' as const,
    params: { turfId: 't1', turfName: 'Green Park Box Cricket', date: '2026-09-10' },
  };
  return {
    ...render(<TurfAvailabilityScreen navigation={navigation as never} route={route as never} />),
    navigation,
  };
}

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

describe('TurfAvailabilityScreen (module 2.3)', () => {
  beforeEach(() => {
    mockGetAvailability.mockReset();
    mockCreateBooking.mockReset();
  });

  it('visually distinguishes AVAILABLE from BOOKED slots and disables the booked one', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    const { getByTestId } = renderScreen();

    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    const availableSlot = getByTestId('slot-18:00:00');
    const bookedSlot = getByTestId('slot-19:00:00');

    expect(availableSlot.props.accessibilityState?.disabled).not.toBe(true);
    expect(bookedSlot.props.accessibilityState?.disabled).toBe(true);
  });

  it('opens the booking confirmation modal only for an available slot', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    const { getByTestId, queryByTestId } = renderScreen();

    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    fireEvent.press(getByTestId('slot-18:00:00'));

    await waitFor(() => expect(queryByTestId('confirm-booking-button')).toBeTruthy());
  });

  it('creates a booking and navigates to Booking Confirmation on success', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    mockCreateBooking.mockResolvedValueOnce({ booking_id: 'b1' });

    const { getByTestId, navigation } = renderScreen();
    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    fireEvent.press(getByTestId('slot-18:00:00'));
    await waitFor(() => expect(getByTestId('confirm-booking-button')).toBeTruthy());
    fireEvent.press(getByTestId('confirm-booking-button'));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('BookingConfirmation', { bookingId: 'b1' }),
    );
  });

  it('shows the backend\'s clean "slot no longer available" message on a 409 and refreshes the grid', async () => {
    mockGetAvailability.mockResolvedValue(SAMPLE_AVAILABILITY);
    mockCreateBooking.mockRejectedValueOnce(
      new BFAMApiError('This slot is no longer available. Please choose another time.', 409),
    );

    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    fireEvent.press(getByTestId('slot-18:00:00'));
    await waitFor(() => expect(getByTestId('confirm-booking-button')).toBeTruthy());
    fireEvent.press(getByTestId('confirm-booking-button'));

    await waitFor(() =>
      expect(getByTestId('booking-error-message').props.children).toBe(
        'This slot is no longer available. Please choose another time.',
      ),
    );
    // The grid re-fetch after a conflict is what lets the user see the slot
    // as BOOKED rather than retrying the same dead slot blindly.
    expect(mockGetAvailability).toHaveBeenCalledTimes(2);
  });
});
