import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getHomeBanners: jest.fn() },
}));

const mockGetHomeBanners = apiClient.getHomeBanners as jest.Mock;

import { HomeBannerCarousel } from '../src/components/HomeBannerCarousel';

const BANNER = {
  banner_id: 'b1',
  title: 'Summer Offer',
  image_url: 'https://example.com/banner.png',
  link_url: 'https://example.com/offer',
  display_order: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_by: null,
  created_at: '',
  updated_at: '',
};

// Backlog B-6: Home page carousel for offers.
describe('HomeBannerCarousel (backlog B-6)', () => {
  beforeEach(() => {
    mockGetHomeBanners.mockReset();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  it('renders nothing when there are no active banners', async () => {
    mockGetHomeBanners.mockResolvedValueOnce({ results: [] });
    const { queryByTestId } = render(<HomeBannerCarousel />);

    await waitFor(() => expect(mockGetHomeBanners).toHaveBeenCalled());
    expect(queryByTestId('home-banner-carousel')).toBeNull();
  });

  it('renders a banner and opens its link when tapped', async () => {
    mockGetHomeBanners.mockResolvedValueOnce({ results: [BANNER] });
    const { findByTestId } = render(<HomeBannerCarousel />);

    const banner = await findByTestId('home-banner-b1');
    fireEvent.press(banner);

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/offer');
  });

  it('renders a link-less banner as non-interactive', async () => {
    mockGetHomeBanners.mockResolvedValueOnce({ results: [{ ...BANNER, link_url: null }] });
    const { findByTestId } = render(<HomeBannerCarousel />);

    const banner = await findByTestId('home-banner-b1');
    expect(banner.props.accessibilityState?.disabled ?? banner.props.disabled).toBeTruthy();
  });
});
