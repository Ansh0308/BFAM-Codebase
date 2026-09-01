import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockGetMyProfile = jest.fn();
const mockSendEmailOtp = jest.fn();
const mockVerifyEmailOtp = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
    sendEmailOtp: (...args: unknown[]) => mockSendEmailOtp(...args),
    verifyEmailOtp: (...args: unknown[]) => mockVerifyEmailOtp(...args),
  },
}));

import EmailSettings from '../app/email-settings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enterOtp(findByTestId: (id: string) => Promise<any>, code: string) {
  for (let i = 0; i < code.length; i++) {
    const box = await findByTestId(`email-otp-input-${i}`);
    fireEvent.changeText(box, code[i]);
  }
}

describe('EmailSettings screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyProfile.mockResolvedValue({ email: null, email_verified_at: null });
  });

  it('shows "no verified email" when nothing is on file', async () => {
    const { findByTestId } = render(<EmailSettings />);
    const row = await findByTestId('email-status-row');
    expect(row).toBeTruthy();
    await findByTestId('email-input');
  });

  it('shows the verified email when one exists', async () => {
    mockGetMyProfile.mockResolvedValue({
      email: 'player@bfam.local',
      email_verified_at: '2026-08-30T00:00:00Z',
    });

    const { findByTestId } = render(<EmailSettings />);
    const status = await findByTestId('email-status-row');
    expect(status).toBeTruthy();
  });

  it('sends an OTP, then verifies it and updates the status', async () => {
    mockSendEmailOtp.mockResolvedValue({ message: 'sent', dev_otp: '123456' });
    mockVerifyEmailOtp.mockResolvedValue({
      email: 'newplayer@bfam.local',
      email_verified_at: '2026-08-30T00:00:00Z',
    });

    const { findByTestId } = render(<EmailSettings />);
    const input = await findByTestId('email-input');
    fireEvent.changeText(input, 'newplayer@bfam.local');

    fireEvent.press(await findByTestId('email-send-otp'));

    await waitFor(() => {
      expect(mockSendEmailOtp).toHaveBeenCalledWith('newplayer@bfam.local');
    });
    await findByTestId('email-otp-input-0');

    await enterOtp(findByTestId, '123456');
    fireEvent.press(await findByTestId('email-verify-otp'));

    await waitFor(() => {
      expect(mockVerifyEmailOtp).toHaveBeenCalledWith('newplayer@bfam.local', '123456');
    });
  });

  it('shows a clear error when the email is already registered to another account', async () => {
    mockSendEmailOtp.mockResolvedValue({ message: 'sent', dev_otp: '123456' });
    const conflictError = new Error('conflict') as Error & { status?: number };
    conflictError.status = 409;
    mockVerifyEmailOtp.mockRejectedValueOnce(conflictError);

    const { findByTestId } = render(<EmailSettings />);
    fireEvent.changeText(await findByTestId('email-input'), 'taken@bfam.local');
    fireEvent.press(await findByTestId('email-send-otp'));

    await findByTestId('email-otp-input-0');
    await enterOtp(findByTestId, '123456');
    fireEvent.press(await findByTestId('email-verify-otp'));

    const error = await findByTestId('email-settings-error');
    expect(error.props.children).toMatch(/already registered/i);
  });

  it('shows an error for an incorrect/expired code', async () => {
    mockSendEmailOtp.mockResolvedValue({ message: 'sent', dev_otp: '123456' });
    mockVerifyEmailOtp.mockRejectedValueOnce(new Error('invalid'));

    const { findByTestId } = render(<EmailSettings />);
    fireEvent.changeText(await findByTestId('email-input'), 'player@bfam.local');
    fireEvent.press(await findByTestId('email-send-otp'));

    await findByTestId('email-otp-input-0');
    await enterOtp(findByTestId, '000000');
    fireEvent.press(await findByTestId('email-verify-otp'));

    const error = await findByTestId('email-settings-error');
    expect(error.props.children).toMatch(/incorrect|expired/i);
  });
});
