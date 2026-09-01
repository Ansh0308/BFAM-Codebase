import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getObligations: jest.fn(),
    createObligations: jest.fn(),
    recordCashPayment: jest.fn(),
    initiateGatewayPayment: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ bookingId: 'booking-1' }),
}));

const mockGetObligations = apiClient.getObligations as jest.Mock;
const mockCreateObligations = apiClient.createObligations as jest.Mock;
const mockRecordCashPayment = apiClient.recordCashPayment as jest.Mock;

import PaymentScreen from '../app/(tabs)/discover/booking/[bookingId]/payment';

const OBLIGATION = {
  obligation_id: 'ob-1',
  booking_id: 'booking-1',
  player_id: null,
  amount_due: 1000,
  due_status: 'PENDING',
  created_at: '',
  updated_at: '',
};

describe('Payment screen (module 2.4)', () => {
  beforeEach(() => {
    mockGetObligations.mockReset();
    mockCreateObligations.mockReset();
    mockRecordCashPayment.mockReset();
    mockPush.mockReset();
  });

  it('offers all 5 payment method options (PRD §12.16)', async () => {
    mockGetObligations.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = render(<PaymentScreen />);

    expect(await findByTestId('payment-method-UPI')).toBeTruthy();
    expect(await findByTestId('payment-method-RAZORPAY')).toBeTruthy();
    expect(await findByTestId('payment-method-CASH')).toBeTruthy();
    expect(await findByTestId('payment-method-CAPTAIN_PAYS')).toBeTruthy();
    expect(await findByTestId('payment-method-SPLIT')).toBeTruthy();
  });

  it('records a cash payment for the full amount and reaches the done state', async () => {
    mockGetObligations.mockResolvedValue({ results: [OBLIGATION] });
    mockRecordCashPayment.mockResolvedValueOnce({ payment_id: 'pay-1' });

    const { findByTestId } = render(<PaymentScreen />);

    fireEvent.press(await findByTestId('payment-method-CASH'));
    fireEvent.press(await findByTestId('confirm-cash-payment'));

    await waitFor(() => expect(mockRecordCashPayment).toHaveBeenCalledWith(['ob-1'], undefined));
    expect(await findByTestId('payment-done')).toBeTruthy();
  });

  it('shows a clean error message when the cash payment fails', async () => {
    mockGetObligations.mockResolvedValue({ results: [OBLIGATION] });
    mockRecordCashPayment.mockRejectedValueOnce(new Error('boom'));

    const { findByTestId } = render(<PaymentScreen />);
    fireEvent.press(await findByTestId('payment-method-CASH'));
    fireEvent.press(await findByTestId('confirm-cash-payment'));

    expect(await findByTestId('cash-entry-screen')).toBeTruthy();
  });
});
