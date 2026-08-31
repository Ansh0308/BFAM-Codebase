import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockGetMyProfile = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
  },
}));

import ProfileSettings from '../app/profile-settings';

const BASE_PROFILE = {
  user_id: 'u1',
  bfam_id: 'BF1000',
  role: 'PLAYER',
  phone_number: '+919876543210',
  email: null,
  email_verified_at: null,
  profile_photo_url: null,
  city: null,
  preferred_language: null,
  playing_role: null,
  batting_style: null,
  bowling_style: null,
  experience_level: null,
  skill_rating: null,
  reliability_score: null,
  favorite_cricketer_name: null,
  favorite_cricketer_external_id: null,
};

describe('ProfileSettings screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyProfile.mockResolvedValue(BASE_PROFILE);
  });

  it('navigates to each sub-screen when its row is pressed', async () => {
    const { getByTestId } = render(<ProfileSettings />);

    fireEvent.press(getByTestId('settings-row-edit-profile'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile-setup'));

    fireEvent.press(getByTestId('settings-row-notifications'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/notification-settings'));

    fireEvent.press(getByTestId('settings-row-privacy'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/privacy-settings'));

    fireEvent.press(getByTestId('settings-row-payment'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/payment-methods'));

    fireEvent.press(getByTestId('settings-row-language'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/language'));

    fireEvent.press(getByTestId('settings-row-email'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/email-settings'));
  });

  it('shows "Not verified" when no email is verified', async () => {
    const { findByTestId } = render(<ProfileSettings />);
    const status = await findByTestId('settings-row-email-status');
    expect(status.props.children).toBe('Not verified');
  });

  it('shows the verified email when one exists', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...BASE_PROFILE,
      email: 'player@bfam.local',
      email_verified_at: '2026-08-30T00:00:00Z',
    });

    const { findByTestId } = render(<ProfileSettings />);
    const status = await findByTestId('settings-row-email-status');
    expect(status.props.children).toBe('player@bfam.local');
  });
});
