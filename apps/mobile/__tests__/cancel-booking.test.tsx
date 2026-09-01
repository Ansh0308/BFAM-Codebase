import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { cancelBooking: jest.fn() },
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ bookingId: 'b1' }),
}));

const mockCancelBooking = apiClient.cancelBooking as jest.Mock;

import CancelBooking from '../app/(tabs)/discover/booking/[bookingId]/cancel';

describe('CancelBooking screen (module 2.3)', () => {
  beforeEach(() => {
    mockCancelBooking.mockReset();
    mockReplace.mockReset();
    mockBack.mockReset();
  });

  it('submits the cancellation reason and returns to Booking Details on success', async () => {
    mockCancelBooking.mockResolvedValueOnce({ booking_id: 'b1', booking_status: 'CANCELLED' });
    const { getByTestId } = render(<CancelBooking />);

    fireEvent.changeText(getByTestId('cancellation-reason-input'), 'Rained out');
    fireEvent.press(getByTestId('confirm-cancel-button'));

    await waitFor(() => expect(mockCancelBooking).toHaveBeenCalledWith('b1', 'Rained out'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/discover/booking/b1');
  });

  it('shows a clean error message when cancellation fails', async () => {
    mockCancelBooking.mockRejectedValueOnce(new Error('network down'));
    const { getByTestId, findByText } = render(<CancelBooking />);

    fireEvent.press(getByTestId('confirm-cancel-button'));

    expect(await findByText(/could not cancel this booking/i)).toBeTruthy();
  });
});
