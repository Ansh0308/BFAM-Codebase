import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ identifier: '+919876543210', purpose: 'SIGNUP' }),
}));

const mockSendOtp = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    sendOtp: (...args: unknown[]) => mockSendOtp(...args),
    verifyOtp: jest.fn(),
    setToken: jest.fn(),
  },
}));

import OtpVerification from '../app/otp-verification';

// Feedback: SIGNUP with a number that already has an account used to land
// the player on the "enter the code" screen (claiming a code was texted,
// when the server never sent one) with no way back to Signup.
describe('OtpVerification — SIGNUP with an existing account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendOtp.mockRejectedValue(
      new BFAMApiError('An account already exists for this phone number', 409),
    );
  });

  it('shows the server error instead of the "code sent" screen', async () => {
    const { findByText, queryByTestId } = await render(<OtpVerification />);

    await findByText('An account already exists for this phone number');
    expect(queryByTestId('otp-input-0')).toBeNull();
  });

  it('has a back button that returns to the previous screen', async () => {
    const { findByTestId } = await render(<OtpVerification />);

    const backButton = await findByTestId('otp-back-button');
    await fireEvent.press(backButton);

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
