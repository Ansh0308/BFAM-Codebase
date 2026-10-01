import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, []);
  },
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTurfs: jest.fn(),
    getHomeBanners: jest.fn(),
    getMyProfile: jest.fn(),
    getPlayerStatistics: jest.fn(),
    getMyMatches: jest.fn(),
    getNotifications: jest.fn(),
    getLiveScore: jest.fn(),
  },
}));

jest.mock('../src/screens/OwnerDashboard', () => ({ OwnerDashboard: () => null }));
jest.mock('../src/screens/StaffDashboard', () => ({ StaffDashboard: () => null }));

const mockGetTurfs = apiClient.getTurfs as jest.Mock;
const mockGetHomeBanners = apiClient.getHomeBanners as jest.Mock;
const mockGetMyProfile = apiClient.getMyProfile as jest.Mock;
const mockGetPlayerStatistics = apiClient.getPlayerStatistics as jest.Mock;
const mockGetMyMatches = apiClient.getMyMatches as jest.Mock;
const mockGetNotifications = apiClient.getNotifications as jest.Mock;

import Home from '../app/(tabs)/index';
import { useAuthStore } from '../src/store/authStore';

// Feedback: with Discover re-enabled (the current default in
// featureFlags.ts), Home's Book Turf quick action should open the turf list
// (Discover) rather than skip straight to one turf's time slots.
jest.mock('../src/config/featureFlags', () => ({ DISCOVERY_ENABLED: true }));

describe('Home — Book Turf quick action with Discover enabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    mockGetHomeBanners.mockResolvedValue({ results: [] });
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });
    mockGetMyProfile.mockResolvedValue({ bfam_id: 'BF1000', full_name: null, coin_balance: null });
    mockGetPlayerStatistics.mockResolvedValue(null);
    mockGetMyMatches.mockResolvedValue({ results: [] });
    mockGetNotifications.mockResolvedValue({ results: [] });
  });

  it('opens Discover instead of jumping to a turf availability screen', async () => {
    const { getByTestId } = await render(<Home />);

    await fireEvent.press(getByTestId('home-book-turf-quick-action'));

    expect(mockGetTurfs).not.toHaveBeenCalled();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover'));
  });
});
