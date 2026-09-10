import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getObligations: jest.fn(),
    createObligations: jest.fn(),
    recordCashPayment: jest.fn(),
    initiateGatewayPayment: jest.fn(),
    getBookingDetails: jest.fn(),
    getMyProfile: jest.fn(),
    applyCheckoutDiscount: jest.fn(),
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
const mockGetBookingDetails = apiClient.getBookingDetails as jest.Mock;
const mockGetMyProfile = apiClient.getMyProfile as jest.Mock;
const mockApplyCheckoutDiscount = apiClient.applyCheckoutDiscount as jest.Mock;

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
    mockGetBookingDetails.mockReset();
    mockPush.mockReset();
    mockGetMyProfile.mockReset().mockResolvedValue({ coin_balance: 0 });
    mockApplyCheckoutDiscount.mockReset();
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

  it('splits the booking amount evenly across the entered share count', async () => {
    mockGetObligations.mockResolvedValueOnce({ results: [] });
    mockGetBookingDetails.mockResolvedValueOnce({ booking_id: 'booking-1', booking_amount: 1000 });
    const shareObligations = [1, 2, 3].map((n) => ({
      ...OBLIGATION,
      obligation_id: `ob-${n}`,
      amount_due: n === 3 ? 333.34 : 333.33,
    }));
    mockCreateObligations.mockResolvedValueOnce({ results: shareObligations });

    const { findByTestId } = render(<PaymentScreen />);

    fireEvent.press(await findByTestId('payment-method-SPLIT'));
    fireEvent.changeText(await findByTestId('split-share-count-input'), '3');
    fireEvent.press(await findByTestId('submit-split-setup'));

    await waitFor(() =>
      expect(mockCreateObligations).toHaveBeenCalledWith('booking-1', {
        shares: [
          { player_id: null, amount: 333.33 },
          { player_id: null, amount: 333.33 },
          { player_id: null, amount: 333.34 },
        ],
      }),
    );

    // Only the booker's own share (the first one) shows as due — the other
    // two remain PENDING for other players to pay separately.
    const dueText = await findByTestId('payment-amount-due');
    expect(dueText.props.children.join('')).toBe('₹333.33 due');
  });

  it("settles only the booker's own share after a split, not the whole booking", async () => {
    mockGetObligations.mockResolvedValueOnce({ results: [] });
    mockGetBookingDetails.mockResolvedValueOnce({ booking_id: 'booking-1', booking_amount: 1000 });
    const shareObligations = [
      { ...OBLIGATION, obligation_id: 'ob-1', amount_due: 500 },
      { ...OBLIGATION, obligation_id: 'ob-2', amount_due: 500 },
    ];
    mockCreateObligations.mockResolvedValueOnce({ results: shareObligations });
    mockRecordCashPayment.mockResolvedValueOnce({ payment_id: 'pay-1' });

    const { findByTestId } = render(<PaymentScreen />);

    fireEvent.press(await findByTestId('payment-method-SPLIT'));
    fireEvent.changeText(await findByTestId('split-share-count-input'), '2');
    fireEvent.press(await findByTestId('submit-split-setup'));
    await findByTestId('payment-method-selector');

    fireEvent.press(await findByTestId('payment-method-CASH'));
    fireEvent.press(await findByTestId('confirm-cash-payment'));

    await waitFor(() => expect(mockRecordCashPayment).toHaveBeenCalledWith(['ob-1'], undefined));
  });

  // Backlog B-1: promo code / BFAM Coins at checkout.
  describe('promo code and BFAM Coins', () => {
    it('applies a promo code and reflects the reduced amount due', async () => {
      mockGetObligations
        .mockResolvedValueOnce({ results: [OBLIGATION] })
        .mockResolvedValueOnce({ results: [{ ...OBLIGATION, amount_due: 900 }] });
      mockApplyCheckoutDiscount.mockResolvedValueOnce({
        obligation_id: 'ob-1',
        original_amount_due: 1000,
        promo_discount: 100,
        coins_spent: 0,
        coin_discount: 0,
        new_amount_due: 900,
        coin_balance: 0,
      });

      const { findByTestId } = render(<PaymentScreen />);
      fireEvent.changeText(await findByTestId('promo-code-input'), 'SAVE10');
      fireEvent.press(await findByTestId('apply-discount-button'));

      await waitFor(() =>
        expect(mockApplyCheckoutDiscount).toHaveBeenCalledWith('ob-1', {
          promo_code: 'SAVE10',
          coins_to_redeem: undefined,
        }),
      );
      expect(await findByTestId('discount-applied-note')).toBeTruthy();
      const dueText = await findByTestId('payment-amount-due');
      expect(dueText.props.children.join('')).toBe('₹900 due');
    });

    it('offers to redeem coins once the player profile shows a positive balance', async () => {
      mockGetObligations.mockResolvedValue({ results: [OBLIGATION] });
      mockGetMyProfile.mockResolvedValueOnce({ coin_balance: 150 });

      const { findByTestId } = render(<PaymentScreen />);

      expect(await findByTestId('coins-to-redeem-input')).toBeTruthy();
    });

    it('hides the coins field when the player has no coins', async () => {
      mockGetObligations.mockResolvedValue({ results: [OBLIGATION] });
      mockGetMyProfile.mockResolvedValueOnce({ coin_balance: 0 });

      const { findByTestId, queryByTestId } = render(<PaymentScreen />);
      await findByTestId('checkout-discount-section');

      expect(queryByTestId('coins-to-redeem-input')).toBeNull();
    });

    it('shows a clean error when the promo code is rejected', async () => {
      mockGetObligations.mockResolvedValue({ results: [OBLIGATION] });
      mockApplyCheckoutDiscount.mockRejectedValueOnce(new Error('generic'));

      const { findByTestId } = render(<PaymentScreen />);
      fireEvent.changeText(await findByTestId('promo-code-input'), 'BADCODE');
      fireEvent.press(await findByTestId('apply-discount-button'));

      expect(await findByTestId('discount-error-message')).toBeTruthy();
    });
  });
});
