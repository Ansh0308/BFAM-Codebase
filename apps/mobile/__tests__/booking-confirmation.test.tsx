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
}));

const mockGetBookingDetails = apiClient.getBookingDetails as jest.Mock;

import BookingConfirmation from '../app/(tabs)/discover/booking/[bookingId]/confirmation';

describe('BookingConfirmation screen (module 2.3)', () => {
  beforeEach(() => {
    mockGetBookingDetails.mockReset();
    mockPush.mockReset();
  });

  it('hands off to the payment stub only — never marks the booking confirmed itself', async () => {
    mockGetBookingDetails.mockResolvedValueOnce({
      booking_id: 'b1',
      booking_date: '2026-09-10',
      start_time: '18:00:00',
      end_time: '19:00:00',
      booking_amount: '1000.00',
      booking_status: 'PENDING',
    });

    const { getByTestId } = render(<BookingConfirmation />);

    await waitFor(() => expect(getByTestId('proceed-to-payment-button')).toBeTruthy());
    fireEvent.press(getByTestId('proceed-to-payment-button'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/booking/b1/payment');
  });
});
