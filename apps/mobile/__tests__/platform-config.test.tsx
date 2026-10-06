import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.0' } },
}));
jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getPublicConfig: jest.fn(), getHomeContent: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import { PlatformNotice } from '../src/components/PlatformNotice';
import { HomeFeatured } from '../src/components/home/HomeFeatured';
import { isOlderVersion } from '../src/lib/appVersion';

const api = apiClient as unknown as Record<string, jest.Mock>;

const config = (over: Record<string, unknown> = {}) => ({
  support: { phone: '', email: '' },
  legal: { terms_url: '', privacy_url: '' },
  app: { min_version: '', maintenance: { enabled: false, message: '' } },
  coins: { value_in_rupees: 1 },
  booking: { max_advance_days: null },
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('isOlderVersion', () => {
  it('compares numerically, not as text', () => {
    expect(isOlderVersion('1.2.0', '1.10.0')).toBe(true);
    expect(isOlderVersion('1.10.0', '1.2.0')).toBe(false);
    expect(isOlderVersion('1.2', '1.2.0')).toBe(false);
  });
  it('never blocks on an empty or unreadable minimum', () => {
    expect(isOlderVersion('1.2.0', '')).toBe(false);
    expect(isOlderVersion('1.2.0', 'soon')).toBe(false);
  });
});

describe('PlatformNotice', () => {
  it('shows nothing when everything is normal', async () => {
    api.getPublicConfig.mockResolvedValue(config());
    const { queryByTestId } = await render(<PlatformNotice />);
    await waitFor(() => expect(api.getPublicConfig).toHaveBeenCalled());
    expect(queryByTestId('platform-notice')).toBeNull();
  });

  it('shows the admin message during maintenance', async () => {
    api.getPublicConfig.mockResolvedValue(
      config({ app: { min_version: '', maintenance: { enabled: true, message: 'Back at 6pm.' } } }),
    );
    const { findByTestId } = await render(<PlatformNotice />);
    expect(await findByTestId('platform-notice')).toBeTruthy();
    expect(await findByTestId('platform-notice')).toHaveTextContent('Back at 6pm.');
  });

  it('asks the player to update when this install is too old', async () => {
    api.getPublicConfig.mockResolvedValue(
      config({ app: { min_version: '1.5.0', maintenance: { enabled: false, message: '' } } }),
    );
    const { findByTestId } = await render(<PlatformNotice />);
    expect(await findByTestId('platform-notice')).toHaveTextContent(/1.5.0/);
  });

  it('stays quiet if the config cannot be read', async () => {
    api.getPublicConfig.mockRejectedValue(new Error('offline'));
    const { queryByTestId } = await render(<PlatformNotice />);
    await waitFor(() => expect(api.getPublicConfig).toHaveBeenCalled());
    expect(queryByTestId('platform-notice')).toBeNull();
  });
});

describe('HomeFeatured', () => {
  it('renders nothing when there is nothing featured', async () => {
    api.getHomeContent.mockResolvedValue({
      offers: [],
      turfs: [],
      tournaments: [],
      announcements: [],
    });
    const { queryByTestId } = await render(<HomeFeatured />);
    await waitFor(() => expect(api.getHomeContent).toHaveBeenCalled());
    expect(queryByTestId('home-featured')).toBeNull();
  });

  it('shows the picked items and opens a tournament', async () => {
    api.getHomeContent.mockResolvedValue({
      announcements: [{ item_id: 'a1', title: 'Diwali cup', body: 'Sign up now', link_url: null }],
      offers: [
        {
          item_id: 'o1',
          code: 'WELCOME50',
          label: '50% off',
          min_booking_amount: 500,
          valid_until: null,
          title: null,
        },
      ],
      turfs: [
        {
          item_id: 't1',
          turf_id: 'turf1',
          turf_name: 'Green Park',
          city: 'Pune',
          average_rating: '4.6',
          title: null,
        },
      ],
      tournaments: [
        {
          item_id: 'x1',
          tournament_id: 'tn1',
          name: 'Pune Premier',
          entry_fee: 1000,
          start_date: null,
          status: 'OPEN',
          title: null,
        },
      ],
    });
    const { findByTestId, getByText } = await render(<HomeFeatured />);
    expect(await findByTestId('featured-announcement-a1')).toBeTruthy();
    expect(getByText('WELCOME50')).toBeTruthy();
    await fireEvent.press(await findByTestId('featured-turf-t1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/turf/turf1');
    await fireEvent.press(await findByTestId('featured-tournament-x1'));
    expect(mockPush).toHaveBeenCalledWith('/tournament/tn1');
  });

  it('stays quiet when it cannot load', async () => {
    api.getHomeContent.mockRejectedValue(new Error('offline'));
    const { queryByTestId } = await render(<HomeFeatured />);
    await waitFor(() => expect(api.getHomeContent).toHaveBeenCalled());
    expect(queryByTestId('home-featured')).toBeNull();
  });
});
