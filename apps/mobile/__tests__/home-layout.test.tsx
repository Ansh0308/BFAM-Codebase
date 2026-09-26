import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

// Regression: the Home screen once rendered edge to edge on the web. Its scroll
// view is React Native's own Animated.ScrollView, which NativeWind does not
// process, so the `px-5` className on it was silently ignored. The side padding
// must come from real style props.

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
jest.mock('../src/config/featureFlags', () => ({ DISCOVERY_ENABLED: false }));

import Home from '../app/(tabs)/index';
import { useAuthStore } from '../src/store/authStore';

describe('Home — layout', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    (apiClient.getHomeBanners as jest.Mock).mockResolvedValue({ results: [] });
    (apiClient.getTurfs as jest.Mock).mockResolvedValue({ page: 1, page_size: 20, results: [] });
    (apiClient.getMyProfile as jest.Mock).mockResolvedValue({
      bfam_id: 'BF1000',
      full_name: null,
      coin_balance: null,
    });
    (apiClient.getPlayerStatistics as jest.Mock).mockResolvedValue(null);
    (apiClient.getMyMatches as jest.Mock).mockResolvedValue({ results: [] });
    (apiClient.getNotifications as jest.Mock).mockResolvedValue({ results: [] });
  });

  it('insets the content from the screen edges with real style props', async () => {
    const { getByTestId } = await render(<Home />);
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

    const scroll = getByTestId('home-screen');
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(content?.paddingHorizontal).toBe(20);
  });
});
