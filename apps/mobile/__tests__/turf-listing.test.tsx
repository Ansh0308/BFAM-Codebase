import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getTurfs: jest.fn() },
}));

const mockPush = jest.fn();
// useFocusEffect (from expo-router, which implements it natively rather than
// via react-navigation as of SDK 57) normally needs the real router context
// this standalone test doesn't set up, so swap it for a plain effect that
// reruns whenever the memoized callback identity changes — matching real
// useFocusEffect's behavior while a screen stays focused (this screen's
// callback is memoized on [fetchTurfs, query, coords], so this also
// re-fetches once location resolves asynchronously).
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
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

    const { findAllByTestId, queryByText } = await render(<TurfListing />);

    const cards = await findAllByTestId('turf-card-t1');
    expect(cards.length).toBeGreaterThan(0);
    expect(mockGetTurfs).toHaveBeenCalledWith({});
    // Map view is explicitly out of scope for this module.
    expect(queryByText(/map/i)).toBeNull();
  });

  it('re-fetches with the search query when the user submits the search box', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });

    const { getByTestId } = await render(<TurfListing />);
    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledTimes(1));

    await fireEvent.changeText(getByTestId('turf-search-input'), 'Green Park');
    fireEvent(getByTestId('turf-search-input'), 'submitEditing');

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({ q: 'Green Park' }));
  });

  it('shows an empty-state message when no turfs match', async () => {
    mockGetTurfs.mockResolvedValueOnce({ page: 1, page_size: 20, results: [] });
    const { findByText } = await render(<TurfListing />);
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

    const { findAllByTestId } = await render(<TurfListing />);
    const cards = await findAllByTestId('turf-card-t1');
    await fireEvent.press(cards[0]);

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/turf/t1');
  });

  it('re-fetches with lat/lng once location permission is granted, for real "Near You" sorting', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 22.3039, longitude: 70.8022 },
    });

    await render(<TurfListing />);

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({ lat: 22.3039, lng: 70.8022 }));
  });

  it('falls back to an unsorted listing when location permission is denied', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await render(<TurfListing />);

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({}));
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  describe('grouping pitches that share a venue (feedback follow-up)', () => {
    it('shows one card per venue instead of one per pitch, with a pitch count', async () => {
      mockGetTurfs.mockResolvedValueOnce({
        page: 1,
        page_size: 20,
        results: [
          {
            turf_id: 't1',
            turf_name: 'Pitch 1',
            city: 'Rajkot',
            address_line: 'Ring Road',
            ball_types_supported: ['TENNIS'],
            average_rating: null,
            cover_image_url: null,
            min_price_per_hour: 1200,
            distance_km: null,
            venue_id: 'v1',
            venue_name: 'Redline Sports Complex',
          },
          {
            turf_id: 't2',
            turf_name: 'Pitch 2',
            city: 'Rajkot',
            address_line: 'Ring Road',
            ball_types_supported: ['TENNIS'],
            average_rating: null,
            cover_image_url: null,
            min_price_per_hour: 900,
            distance_km: null,
            venue_id: 'v1',
            venue_name: 'Redline Sports Complex',
          },
          {
            turf_id: 't3',
            turf_name: 'Solo Turf',
            city: 'Rajkot',
            address_line: 'MG Road',
            ball_types_supported: ['TENNIS'],
            average_rating: null,
            cover_image_url: null,
            min_price_per_hour: 1000,
            distance_km: null,
            venue_id: null,
            venue_name: null,
          },
        ],
      });

      const { findAllByTestId, findAllByText, queryAllByTestId } = await render(<TurfListing />);

      expect((await findAllByTestId('venue-card-v1')).length).toBeGreaterThan(0);
      expect((await findAllByText('Redline Sports Complex')).length).toBeGreaterThan(0);
      // Cheapest pitch's price is shown for the group ("From ₹900/hr").
      expect((await findAllByText(/From ₹900\/hr/)).length).toBeGreaterThan(0);
      expect((await findAllByTestId('turf-card-t3')).length).toBeGreaterThan(0);
      expect(queryAllByTestId('turf-card-t1')).toHaveLength(0);
      expect(queryAllByTestId('turf-card-t2')).toHaveLength(0);
    });

    it('navigates to the venue pitch picker when a grouped venue card is pressed', async () => {
      mockGetTurfs.mockResolvedValueOnce({
        page: 1,
        page_size: 20,
        results: [
          {
            turf_id: 't1',
            turf_name: 'Pitch 1',
            city: 'Rajkot',
            address_line: 'Ring Road',
            ball_types_supported: ['TENNIS'],
            average_rating: null,
            cover_image_url: null,
            min_price_per_hour: 1200,
            distance_km: null,
            venue_id: 'v1',
            venue_name: 'Redline Sports Complex',
          },
          {
            turf_id: 't2',
            turf_name: 'Pitch 2',
            city: 'Rajkot',
            address_line: 'Ring Road',
            ball_types_supported: ['TENNIS'],
            average_rating: null,
            cover_image_url: null,
            min_price_per_hour: 900,
            distance_km: null,
            venue_id: 'v1',
            venue_name: 'Redline Sports Complex',
          },
        ],
      });

      const { findAllByTestId } = await render(<TurfListing />);
      const cards = await findAllByTestId('venue-card-v1');
      await fireEvent.press(cards[0]);

      expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/venue/v1');
    });
  });
});
