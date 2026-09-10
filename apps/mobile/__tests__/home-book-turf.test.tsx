import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getTurfs: jest.fn(),
    getHomeBanners: jest.fn(),
  },
}));

jest.mock('../src/screens/OwnerDashboard', () => ({ OwnerDashboard: () => null }));
jest.mock('../src/screens/StaffDashboard', () => ({ StaffDashboard: () => null }));

const mockGetTurfs = apiClient.getTurfs as jest.Mock;
const mockGetHomeBanners = apiClient.getHomeBanners as jest.Mock;

import Home from '../app/(tabs)/index';
import { useAuthStore } from '../src/store/authStore';

// Backlog A-12: with Discover hidden (see featureFlags.ts, mocked below),
// the Home quick action should skip the listing and go straight to the
// one available turf's availability screen.
jest.mock('../src/config/featureFlags', () => ({ DISCOVERY_ENABLED: false }));

describe('Home — Book Turf quick action with Discover hidden (backlog A-12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    mockGetHomeBanners.mockResolvedValue({ results: [] });
    mockGetTurfs.mockResolvedValue({
      page: 1,
      page_size: 20,
      results: [{ turf_id: 'turf-1', turf_name: 'BFAM Ground' }],
    });
  });

  it('routes straight to the owned turf availability screen instead of Discover', async () => {
    const { getByTestId } = render(<Home />);

    fireEvent.press(getByTestId('home-book-turf-quick-action'));

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({}));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/(tabs)/discover/turf/turf-1/availability?turfName=BFAM%20Ground',
      ),
    );
  });

  it('shows an error if there is no turf to book yet', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });

    const { getByTestId, findByText } = render(<Home />);
    fireEvent.press(getByTestId('home-book-turf-quick-action'));

    await findByText(/no turf is available/i);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
