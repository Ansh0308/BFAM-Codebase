import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CancelBookingScreen } from '../CancelBookingScreen';
import { apiClient } from '../../../lib/apiClient';

jest.mock('../../../lib/apiClient', () => ({
  apiClient: { cancelBooking: jest.fn() },
}));

const mockCancelBooking = apiClient.cancelBooking as jest.Mock;

function renderScreen() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const route = {
    key: 'CancelBooking',
    name: 'CancelBooking' as const,
    params: { bookingId: 'b1' },
  };
  return {
    ...render(<CancelBookingScreen navigation={navigation as never} route={route as never} />),
    navigation,
  };
}

describe('CancelBookingScreen (module 2.3)', () => {
  beforeEach(() => mockCancelBooking.mockReset());

  it('submits the cancellation reason and returns to Booking Details on success', async () => {
    mockCancelBooking.mockResolvedValueOnce({ booking_id: 'b1', booking_status: 'CANCELLED' });
    const { getByTestId, navigation } = renderScreen();

    fireEvent.changeText(getByTestId('cancellation-reason-input'), 'Rained out');
    fireEvent.press(getByTestId('confirm-cancel-button'));

    await waitFor(() => expect(mockCancelBooking).toHaveBeenCalledWith('b1', 'Rained out'));
    expect(navigation.navigate).toHaveBeenCalledWith('BookingDetails', { bookingId: 'b1' });
  });

  it('shows a clean error message when cancellation fails', async () => {
    mockCancelBooking.mockRejectedValueOnce(new Error('network down'));
    const { getByTestId, findByText } = renderScreen();

    fireEvent.press(getByTestId('confirm-cancel-button'));

    expect(await findByText(/could not cancel this booking/i)).toBeTruthy();
  });
});
