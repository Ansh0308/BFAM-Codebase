import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getVenueDetails: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ venueId: 'v1' }),
  useRouter: () => ({ push: mockPush }),
}));

const mockGetVenueDetails = apiClient.getVenueDetails as jest.Mock;

import VenuePitchPickerScreen from '../app/(tabs)/discover/venue/[venueId]';

describe('Venue pitch picker (Discover follow-up feedback)', () => {
  beforeEach(() => {
    mockGetVenueDetails.mockReset();
    mockPush.mockReset();
  });

  it('lists every pitch at the venue', async () => {
    mockGetVenueDetails.mockResolvedValueOnce({
      venue_id: 'v1',
      venue_name: 'Redline Sports Complex',
      address_line: 'Ring Road',
      city: 'Rajkot',
      turfs: [
        { turf_id: 't1', turf_name: 'Pitch 1', cover_image_url: null, min_price_per_hour: 1200 },
        { turf_id: 't2', turf_name: 'Pitch 2', cover_image_url: null, min_price_per_hour: 900 },
      ],
    });

    const { findByText, findByTestId } = await render(<VenuePitchPickerScreen />);

    expect(await findByText('Redline Sports Complex')).toBeTruthy();
    expect(await findByTestId('venue-pitch-card-t1')).toBeTruthy();
    expect(await findByTestId('venue-pitch-card-t2')).toBeTruthy();
  });

  it('opens the normal Turf Details/booking screen for the tapped pitch', async () => {
    mockGetVenueDetails.mockResolvedValueOnce({
      venue_id: 'v1',
      venue_name: 'Redline Sports Complex',
      address_line: 'Ring Road',
      city: 'Rajkot',
      turfs: [
        { turf_id: 't1', turf_name: 'Pitch 1', cover_image_url: null, min_price_per_hour: 1200 },
      ],
    });

    const { findByTestId } = await render(<VenuePitchPickerScreen />);
    await fireEvent.press(await findByTestId('venue-pitch-card-t1'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/discover/turf/t1');
  });

  it('shows an error state when the venue fails to load', async () => {
    mockGetVenueDetails.mockRejectedValueOnce(new Error('not found'));
    const { findByTestId } = await render(<VenuePitchPickerScreen />);
    expect(await findByTestId('venue-picker-error')).toBeTruthy();
  });

  it('shows an empty state when the venue has no active pitches', async () => {
    mockGetVenueDetails.mockResolvedValueOnce({
      venue_id: 'v1',
      venue_name: 'Redline Sports Complex',
      address_line: 'Ring Road',
      city: 'Rajkot',
      turfs: [],
    });
    const { findByTestId } = await render(<VenuePitchPickerScreen />);
    await waitFor(() => expect(mockGetVenueDetails).toHaveBeenCalledWith('v1'));
    expect(await findByTestId('venue-picker-empty')).toBeTruthy();
  });
});
