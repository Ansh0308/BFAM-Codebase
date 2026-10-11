import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

// Regression: a player with a match in progress saw "Something went wrong — undefined is
// not a function" on Home. The live score's overs_completed comes from a DECIMAL column,
// so the server sends it as text ("3.2"), and Home called .toFixed on it.

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
    getHomeContent: jest.fn(),
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

describe('Home — live match card', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    (apiClient.getHomeBanners as jest.Mock).mockResolvedValue({ results: [] });
    (apiClient.getHomeContent as jest.Mock).mockResolvedValue({
      announcements: [],
      offers: [],
      turfs: [],
      tournaments: [],
    });
    (apiClient.getTurfs as jest.Mock).mockResolvedValue({ page: 1, page_size: 20, results: [] });
    (apiClient.getMyProfile as jest.Mock).mockResolvedValue({
      bfam_id: 'BF1000',
      full_name: 'Asha Rao',
      coin_balance: 10,
    });
    (apiClient.getPlayerStatistics as jest.Mock).mockResolvedValue(null);
    (apiClient.getNotifications as jest.Mock).mockResolvedValue({ results: [] });
    (apiClient.getMyMatches as jest.Mock).mockResolvedValue({
      results: [
        {
          match_id: 'm1',
          match_name: 'Sunday Smash',
          match_status: 'IN_PROGRESS',
          scheduled_start_time: new Date().toISOString(),
        },
      ],
    });
  });

  it('shows overs when the server sends them as text', async () => {
    (apiClient.getLiveScore as jest.Mock).mockResolvedValue({
      innings: { total_runs: 41, total_wickets: 2, overs_completed: '3.2' },
    });

    const { findByTestId, findByText } = await render(<Home />);
    expect(await findByTestId('home-live-match-card')).toBeTruthy();
    await waitFor(async () => expect(await findByText('3.2 overs')).toBeTruthy());
  });
});
