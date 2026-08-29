import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BookingConfirmationScreen } from '../BookingConfirmationScreen';
import { apiClient } from '../../../lib/apiClient';

jest.mock('../../../lib/apiClient', () => ({
  apiClient: { getBookingDetails: jest.fn() },
}));

const mockGetBookingDetails = apiClient.getBookingDetails as jest.Mock;

describe('BookingConfirmationScreen (module 2.3)', () => {
  it('hands off to the payment stub only — never marks the booking confirmed itself', async () => {
    mockGetBookingDetails.mockResolvedValueOnce({
      booking_id: 'b1',
      booking_date: '2026-09-10',
      start_time: '18:00:00',
      end_time: '19:00:00',
      booking_amount: '1000.00',
      booking_status: 'PENDING',
    });

    const navigation = { navigate: jest.fn() };
    const route = {
      key: 'BookingConfirmation',
      name: 'BookingConfirmation' as const,
      params: { bookingId: 'b1' },
    };
    const { getByTestId } = render(
      <BookingConfirmationScreen navigation={navigation as never} route={route as never} />,
    );

    await waitFor(() => expect(getByTestId('proceed-to-payment-button')).toBeTruthy());
    fireEvent.press(getByTestId('proceed-to-payment-button'));

    expect(navigation.navigate).toHaveBeenCalledWith('PaymentStub', { bookingId: 'b1' });
  });
});
