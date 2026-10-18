import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BFAMApiClient } from '@bfam/api-client';
import { apiClient } from '../src/lib/apiClient';

// Tester sheet, round 2: payment history showing an internal id, the split-pay screen forgetting
// the booker's own share, a check-in that goes nowhere afterwards, and inviting by BFAM ID.

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyPaymentHistory: jest.fn(),
    getObligations: jest.fn(),
    getMyProfile: jest.fn(),
    getGameRoom: jest.fn(),
    getCheckInCode: jest.fn(),
    checkIn: jest.fn(),
    createObligations: jest.fn(),
    recordCashPayment: jest.fn(),
    initiateGatewayPayment: jest.fn(),
    getBookingDetails: jest.fn(),
    applyCheckoutDiscount: jest.fn(),
  },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ bookingId: 'booking-1', matchId: 'match-1' }),
}));

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false }, jest.fn()],
}));
jest.mock('react-native-qrcode-svg', () => () => null);

import PaymentHistoryScreen from '../app/(tabs)/discover/payment-history';
import PaymentScreen from '../app/(tabs)/discover/booking/[bookingId]/payment';
import CheckInScreen from '../app/(tabs)/matches/[matchId]/check-in';
import { useAuthStore } from '../src/store/authStore';

const mockHistory = apiClient.getMyPaymentHistory as jest.Mock;
const mockObligations = apiClient.getObligations as jest.Mock;
const mockProfile = apiClient.getMyProfile as jest.Mock;
const mockGameRoom = apiClient.getGameRoom as jest.Mock;
const mockCheckIn = apiClient.checkIn as jest.Mock;

describe('Payment History', () => {
  it('shows who collected a cash payment by name, never by internal id', async () => {
    mockHistory.mockResolvedValue({
      results: [
        {
          payment_id: 'p1',
          payer_id: 'u1',
          amount: '800.00',
          currency: 'INR',
          payment_method: 'CASH',
          gateway: 'CASH',
          gateway_order_id: 'CASH-p1',
          collected_by: '532b62c1-0434-41dd-add0-974719d2c125',
          collected_by_name: 'Turf owner',
          payment_status: 'SUCCESS',
          initiated_at: '2026-10-02T10:00:00Z',
        },
      ],
    });
    const { findByTestId, queryByText } = await render(<PaymentHistoryScreen />);
    expect((await findByTestId('collected-by')).props.children.join('')).toContain('Turf owner');
    expect(queryByText(/532b62c1/)).toBeNull();
  });
});

describe('Payment screen — split payment', () => {
  const share = (id: string, playerId: string | null) => ({
    obligation_id: id,
    booking_id: 'booking-1',
    player_id: playerId,
    amount_due: 266.66,
    due_status: 'PENDING',
    created_at: '',
    updated_at: '',
  });

  it("shows only the booker's own share as due when the screen is opened again", async () => {
    mockObligations.mockResolvedValue({
      results: [share('s1', null), share('s2', 'player-me'), share('s3', null)],
    });
    mockProfile.mockResolvedValue({ coin_balance: 0, player_id: 'player-me' });

    const { findByTestId } = await render(<PaymentScreen />);
    const due = await findByTestId('payment-amount-due');
    // Before: all three shares were added up (₹800 due).
    await waitFor(() => expect(due.props.children.join('')).toContain('266.66'));
    expect(due.props.children.join('')).not.toContain('800');
  });
});

describe('Check In', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReplace.mockClear();
    useAuthStore.setState({ user: { user_id: 'player-user', bfam_id: 'BF1', role: 'PLAYER' } });
    mockGameRoom.mockResolvedValue({ organizer_id: 'someone-else', assigned_scorer_id: null });
    mockCheckIn.mockResolvedValue({});
  });
  afterEach(() => jest.useRealTimers());

  it('goes back to the Game Room after a successful check-in', async () => {
    const { findByTestId, getByText } = await render(<CheckInScreen />);
    await fireEvent.changeText(await findByTestId('manual-code-input'), '123456');
    await fireEvent.press(await findByTestId('submit-manual-code'));

    await waitFor(() => expect(getByText(/Checked In/)).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/matches/match-1');
  });
});

describe('BFAMApiClient.inviteToMatch', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function clientWithFetch() {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ invitation_id: 'inv-1' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return { client: new BFAMApiClient('https://api.example.com'), fetchMock };
  }

  it('sends a typed BFAM ID as bfam_id, not as a player_id the server would reject', async () => {
    const { client, fetchMock } = clientWithFetch();
    await client.inviteToMatch('m1', ' BF1001 ');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bfam_id: 'BF1001' });
  });

  it('sends a player UUID as player_id', async () => {
    const { client, fetchMock } = clientWithFetch();
    await client.inviteToMatch('m1', '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      player_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    });
  });
});
