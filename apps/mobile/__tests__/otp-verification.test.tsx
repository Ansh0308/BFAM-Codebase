import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ identifier: '+919876543210', purpose: 'LOGIN' }),
}));

const mockVerifyOtp = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    sendOtp: jest.fn().mockResolvedValue({ message: 'sent', dev_otp: '123456' }),
    verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    setToken: jest.fn(),
  },
}));

import OtpVerification from '../app/otp-verification';

jest.setTimeout(15000);

describe('OtpVerification screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a 6-digit OTP input once the code has been sent', async () => {
    const { findByTestId } = render(<OtpVerification />);

    for (let i = 0; i < 6; i += 1) {
      await findByTestId(`otp-input-${i}`);
    }
  });

  it('submits a valid code and navigates to the hand-off point on LOGIN', async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      token: 'jwt-token',
      user_id: 'u1',
      bfam_id: 'BF1000',
      role: 'PLAYER',
    });

    const { findByTestId } = render(<OtpVerification />);

    for (let i = 0; i < 6; i += 1) {
      const box = await findByTestId(`otp-input-${i}`);
      fireEvent.changeText(box, String(i + 1));
    }

    const verifyButton = await findByTestId('otp-verify');
    fireEvent.press(verifyButton);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith('+919876543210', '123456', 'LOGIN');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/session-active');
    });
  });

  it('shows an error state for an invalid/expired code and clears the input', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('invalid'));

    const { findByTestId, findByText } = render(<OtpVerification />);

    for (let i = 0; i < 6; i += 1) {
      const box = await findByTestId(`otp-input-${i}`);
      fireEvent.changeText(box, '9');
    }

    const verifyButton = await findByTestId('otp-verify');
    fireEvent.press(verifyButton);

    await findByText(/invalid or expired/i);
  });
});
