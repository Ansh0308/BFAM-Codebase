import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getTurfAvailability: jest.fn(), createBooking: jest.fn() },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ turfId: 't1', turfName: 'Green Park Box Cricket' }),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

const mockGetAvailability = apiClient.getTurfAvailability as jest.Mock;
const mockCreateBooking = apiClient.createBooking as jest.Mock;

import TurfAvailability from '../app/(tabs)/discover/turf/[turfId]/availability';

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

// Three consecutive AVAILABLE hours, for exercising the duration stepper
// (Feedback A-1: "let them book multiple slots, e.g. a 3-hour block, at
// once").
const THREE_OPEN_HOURS = {
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
      status: 'AVAILABLE' as const,
      price_per_hour: 1000,
    },
    {
      start_time: '20:00:00',
      end_time: '21:00:00',
      status: 'AVAILABLE' as const,
      price_per_hour: 1200,
    },
  ],
};

describe('TurfAvailability screen (module 2.3)', () => {
  beforeEach(() => {
    mockGetAvailability.mockReset();
    mockCreateBooking.mockReset();
    mockReplace.mockReset();
  });

  it('visually distinguishes AVAILABLE from BOOKED slots and disables the booked one', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    const { getByTestId } = render(<TurfAvailability />);

    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    const availableSlot = getByTestId('slot-18:00:00');
    const bookedSlot = getByTestId('slot-19:00:00');

    expect(availableSlot.props.accessibilityState?.disabled).not.toBe(true);
    expect(bookedSlot.props.accessibilityState?.disabled).toBe(true);
  });

  it('opens the booking confirmation modal only for an available slot', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    const { getByTestId, queryByTestId } = render(<TurfAvailability />);

    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    fireEvent.press(getByTestId('slot-18:00:00'));

    await waitFor(() => expect(queryByTestId('confirm-booking-button')).toBeTruthy());
  });

  it('creates a booking and navigates to Booking Confirmation on success', async () => {
    mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY);
    mockCreateBooking.mockResolvedValueOnce({ booking_id: 'b1' });

    const { getByTestId } = render(<TurfAvailability />);
    await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
    fireEvent.press(getByTestId('slot-18:00:00'));
    await waitFor(() => expect(getByTestId('confirm-booking-button')).toBeTruthy());
    fireEvent.press(getByTestId('confirm-booking-button'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/discover/booking/b1/confirmation'),
    );
  });

  it('shows the backend\'s clean "slot no longer available" message on a 409 and refreshes the grid', async () => {
    mockGetAvailability.mockResolvedValue(SAMPLE_AVAILABILITY);
    mockCreateBooking.mockRejectedValueOnce(
      new BFAMApiError('This slot is no longer available. Please choose another time.', 409),
    );

    const { getByTestId } = render(<TurfAvailability />);
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

  describe('multi-hour booking (feedback A-1)', () => {
    it('defaults to a 1-hour booking and increasing the duration extends the time range, total price, and duration_minutes sent', async () => {
      mockGetAvailability.mockResolvedValueOnce(THREE_OPEN_HOURS);
      mockCreateBooking.mockResolvedValueOnce({ booking_id: 'b1' });

      const { getByTestId } = render(<TurfAvailability />);
      await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
      fireEvent.press(getByTestId('slot-18:00:00'));

      await waitFor(() => expect(getByTestId('duration-hours-value')).toBeTruthy());
      expect(getByTestId('duration-hours-value').props.children.join('')).toBe('1 hr');
      expect(getByTestId('booking-time-range').props.children.join('')).toContain('18:00–19:00');

      fireEvent.press(getByTestId('duration-increase'));
      fireEvent.press(getByTestId('duration-increase'));

      expect(getByTestId('duration-hours-value').props.children.join('')).toBe('3 hrs');
      expect(getByTestId('booking-time-range').props.children.join('')).toContain('18:00–21:00');
      // 1000 + 1000 + 1200, per-hour rates summed rather than the first
      // hour's rate multiplied by 3.
      expect(getByTestId('booking-total-price').props.children.join('')).toBe('₹3200 total');

      fireEvent.press(getByTestId('confirm-booking-button'));

      await waitFor(() =>
        expect(mockCreateBooking).toHaveBeenCalledWith(
          expect.objectContaining({ start_time: '18:00:00', duration_minutes: 180 }),
        ),
      );
    });

    it('caps the duration stepper at the run of contiguous AVAILABLE hours — never across a booked slot', async () => {
      mockGetAvailability.mockResolvedValueOnce(SAMPLE_AVAILABILITY); // 18:00 open, 19:00 booked
      const { getByTestId } = render(<TurfAvailability />);
      await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());
      fireEvent.press(getByTestId('slot-18:00:00'));

      await waitFor(() => expect(getByTestId('duration-hours-value')).toBeTruthy());
      const increaseButton = getByTestId('duration-increase');
      expect(
        increaseButton.props.accessibilityState?.disabled ?? increaseButton.props.disabled,
      ).toBeTruthy();

      fireEvent.press(getByTestId('duration-increase'));
      expect(getByTestId('duration-hours-value').props.children.join('')).toBe('1 hr');
    });

    it('resets the duration back to 1 hour when a different slot is opened', async () => {
      mockGetAvailability.mockResolvedValueOnce(THREE_OPEN_HOURS);
      const { getByTestId } = render(<TurfAvailability />);
      await waitFor(() => expect(getByTestId('slot-18:00:00')).toBeTruthy());

      fireEvent.press(getByTestId('slot-18:00:00'));
      await waitFor(() => expect(getByTestId('duration-hours-value')).toBeTruthy());
      fireEvent.press(getByTestId('duration-increase'));
      expect(getByTestId('duration-hours-value').props.children.join('')).toBe('2 hrs');

      fireEvent.press(getByTestId('cancel-booking-button'));
      fireEvent.press(getByTestId('slot-19:00:00'));

      await waitFor(() =>
        expect(getByTestId('duration-hours-value').props.children.join('')).toBe('1 hr'),
      );
    });
  });
});
