import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TurfListingScreen } from '../TurfListingScreen';
import { apiClient } from '../../../lib/apiClient';

jest.mock('../../../lib/apiClient', () => ({
  apiClient: { getTurfs: jest.fn() },
}));

const mockGetTurfs = apiClient.getTurfs as jest.Mock;

function renderScreen() {
  const navigation = { navigate: jest.fn() };
  const route = { key: 'TurfListing', name: 'TurfListing' as const, params: undefined };
  return {
    ...render(<TurfListingScreen navigation={navigation as never} route={route as never} />),
    navigation,
  };
}

describe('TurfListingScreen (module 2.3)', () => {
  beforeEach(() => {
    mockGetTurfs.mockReset();
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

    const { findAllByTestId, queryByText } = renderScreen();

    const cards = await findAllByTestId('turf-card-t1');
    expect(cards.length).toBeGreaterThan(0);
    expect(mockGetTurfs).toHaveBeenCalledWith({});
    // Map view is explicitly out of scope for this module.
    expect(queryByText(/map/i)).toBeNull();
  });

  it('re-fetches with the search query when the user submits the search box', async () => {
    mockGetTurfs.mockResolvedValue({ page: 1, page_size: 20, results: [] });

    const { getByTestId } = renderScreen();
    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledTimes(1));

    fireEvent.changeText(getByTestId('turf-search-input'), 'Green Park');
    fireEvent(getByTestId('turf-search-input'), 'submitEditing');

    await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({ q: 'Green Park' }));
  });

  it('shows an empty-state message when no turfs match', async () => {
    mockGetTurfs.mockResolvedValueOnce({ page: 1, page_size: 20, results: [] });
    const { findByText } = renderScreen();
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

    const { getAllByTestId, navigation } = renderScreen();
    const cards = await waitFor(() => getAllByTestId('turf-card-t1'));
    fireEvent.press(cards[0]);

    expect(navigation.navigate).toHaveBeenCalledWith('TurfDetails', { turfId: 't1' });
  });
});
