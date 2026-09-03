import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getTurfs: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
}));

const mockGetTurfs = apiClient.getTurfs as jest.Mock;

import TurfListing from '../app/(tabs)/discover/index';

describe('TurfListing screen (module 2.3)', () => {
  beforeEach(() => {
    mockGetTurfs.mockReset();
    mockPush.mockReset();
    mockRequestForegroundPermissionsAsync.mockReset().mockResolvedValue({ status: 'denied' });
    mockGetCurrentPositionAsync.mockReset();
  });

  it('loads and displays turfs on mount, using search/filter only — no map view', async () => {
    mockGetTurfs.mockResolvedValueOnce({
      page: 1,
      page_size: 20,
      results: [
        {
          turf_id: 't1',
          turf_name: 'Green Park Box Cricket',
          city: 'Rajkot',
          address_line: 'Ring Road',
          ball_types_supported: ['TENNIS'],
          average_rating: 4.3,
          cover_image_url: null,
          min_price_per_hour: 1000,
          distance_km: null,
        },
      ],
    });

    const { findAllByTestId, queryByText } = render(<TurfListing />);

    const cards = await findAllByTestId('turf-card-t1');
    expect(cards.length).toBeGreaterThan(0);
    expect(mockGetTurfs).toHaveBeenCalledWith({});
    // Map view is explicitly out of scope for this module.
    expect(queryByText(/map/i)).toBeNull();
  });

  it('re-fetches with the search query when the user submits the search box', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });

    const { getByTestId } = render(<TurfListing />);
    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledTimes(1));

    fireEvent.changeText(getByTestId('turf-search-input'), 'Green Park');
    fireEvent(getByTestId('turf-search-input'), 'submitEditing');

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({ q: 'Green Park' }));
  });

  it('shows an empty-state message when no turfs match', async () => {
    mockGetTurfs.mockResolvedValueOnce({ page: 1, page_size: 20, results: [] });
    const { findByText } = render(<TurfListing />);
    expect(await findByText(/no turfs match/i)).toBeTruthy();
  });

  it('navigates to Turf Details when a turf card is pressed', async () => {
    mockGetTurfs.mockResolvedValueOnce({
      page: 1,
      page_size: 20,
      results: [
        {
          turf_id: 't1',
          turf_name: 'Green Park Box Cricket',
          city: 'Rajkot',
          address_line: 'Ring Road',
          ball_types_supported: ['TENNIS'],
          average_rating: 4.3,
          cover_image_url: null,
          min_price_per_hour: 1000,
          distance_km: null,
        },
      ],
    });

    const { findAllByTestId } = render(<TurfListing />);
    const cards = await findAllByTestId('turf-card-t1');
    fireEvent.press(cards[0]);

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/turf/t1');
  });

  it('re-fetches with lat/lng once location permission is granted, for real "Near You" sorting', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 22.3039, longitude: 70.8022 },
    });

    render(<TurfListing />);

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({ lat: 22.3039, lng: 70.8022 }));
  });

  it('falls back to an unsorted listing when location permission is denied', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    render(<TurfListing />);

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({}));
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
