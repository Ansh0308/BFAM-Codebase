import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(cb, []);
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockGetMyProfile = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyProfile: (...a: unknown[]) => mockGetMyProfile(...a),
    clearToken: jest.fn(),
    setToken: jest.fn(),
  },
}));

import Profile from '../app/(tabs)/profile';
import { useAuthStore } from '../src/store/authStore';

const PLAYER = {
  user_id: 'u1',
  role: 'PLAYER',
  bfam_id: 'BF1318',
  phone_number: '9724400666',
  full_name: null,
  profile_photo_url: null,
  playing_role: 'ALL_ROUNDER',
  batting_style: 'RIGHT_HANDED',
  bowling_style: 'RIGHT_ARM',
  experience_level: 'INTERMEDIATE',
  favorite_cricketer_name: 'Virat Kohli',
  skill_rating: 626,
  follow_summary: { followers_count: 3, following_count: 5 },
};

describe('Profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1318', role: 'PLAYER' } });
    mockGetMyProfile.mockResolvedValue(PLAYER);
  });

  it('shows the BFAM ID, role and every player detail', async () => {
    const { findByText, findByTestId } = await render(<Profile />);

    expect((await findByTestId('profile-bfam-id')).props.children).toBe('BF1318');
    expect(await findByText('Virat Kohli')).toBeTruthy();
    expect(await findByText('Right-Handed')).toBeTruthy();
    expect(await findByText('Right-Arm')).toBeTruthy();
    expect(await findByText('Intermediate')).toBeTruthy();
    expect(await findByTestId('follow-summary')).toBeTruthy();
  });

  it('leads with the player name and shows the BFAM ID beneath it', async () => {
    mockGetMyProfile.mockResolvedValue({ ...PLAYER, full_name: 'Asha Patel' });
    const { findByTestId } = await render(<Profile />);

    expect((await findByTestId('profile-full-name')).props.children).toBe('Asha Patel');
    expect((await findByTestId('profile-bfam-id')).props.children).toBe('BF1318');
  });

  it.each([
    ['stats-section', '/player-statistics'],
    ['leaderboards-section', '/leaderboards'],
    ['xp-level-section', '/xp-level'],
    ['achievements-section', '/achievements'],
    ['rewards-section', '/rewards'],
    ['recognition-section', '/recognition'],
    ['membership-section', '/membership'],
    ['referrals-section', '/referrals'],
    ['match-streaks-section', '/match-streaks'],
  ])('Athlete Hub card %s opens %s', async (testID, route) => {
    const { findByTestId } = await render(<Profile />);

    await fireEvent.press(await findByTestId(testID));
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  it('opens Edit Profile, notifications and settings', async () => {
    const { findByTestId } = await render(<Profile />);

    await fireEvent.press(await findByTestId('edit-profile-button'));
    expect(mockPush).toHaveBeenCalledWith('/profile-setup?from=profile');
    await fireEvent.press(await findByTestId('notifications-button'));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
    await fireEvent.press(await findByTestId('profile-settings-button'));
    expect(mockPush).toHaveBeenCalledWith('/profile-settings');
  });

  it('renders the basic skill rating section', async () => {
    const { findByTestId } = await render(<Profile />);
    expect(await findByTestId('ratings-section')).toBeTruthy();
    expect(await findByTestId('skill-rating-value')).toBeTruthy();
  });

  it('hides player-only sections for a turf owner account', async () => {
    useAuthStore.setState({ user: { user_id: 'u2', bfam_id: null, role: 'TURF_OWNER' } });
    mockGetMyProfile.mockResolvedValue({ ...PLAYER, role: 'TURF_OWNER', bfam_id: null });

    const { findByText, queryByTestId } = await render(<Profile />);

    await findByText(/BFAM IDs, stats, and ratings are for players only/i);
    expect(queryByTestId('stats-section')).toBeNull();
    expect(queryByTestId('ratings-section')).toBeNull();
  });

  it('logs out and returns to the login screen', async () => {
    const { findByTestId } = await render(<Profile />);

    await fireEvent.press(await findByTestId('logout-button'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});
