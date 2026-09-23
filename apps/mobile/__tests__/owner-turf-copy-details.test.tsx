import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getOwnerTurf: jest.fn(),
    listAvailabilityBlocks: jest.fn(),
    getTurfPricing: jest.fn(),
    getTurfOperatingHours: jest.fn(),
    getMyVenues: jest.fn(),
    getMyTurfs: jest.fn(),
    copyTurfDetails: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ turfId: 'turf-target' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const mockGetOwnerTurf = apiClient.getOwnerTurf as jest.Mock;
const mockListAvailabilityBlocks = apiClient.listAvailabilityBlocks as jest.Mock;
const mockGetTurfPricing = apiClient.getTurfPricing as jest.Mock;
const mockGetTurfOperatingHours = apiClient.getTurfOperatingHours as jest.Mock;
const mockGetMyTurfs = apiClient.getMyTurfs as jest.Mock;
const mockCopyTurfDetails = apiClient.copyTurfDetails as jest.Mock;

import ManageTurfScreen from '../app/owner-turfs/[turfId]';

const TARGET_TURF = {
  turf_id: 'turf-target',
  owner_id: 'owner-1',
  turf_name: 'Pitch B',
  address_line: '123 Main St',
  city: 'Rajkot',
  latitude: 0,
  longitude: 0,
  ball_types_supported: [],
  stadium_sound_enabled: false,
  turf_status: 'ACTIVE',
  venue_id: 'venue-1',
};

const OTHER_TURFS = [
  { turf_id: 'turf-target', turf_name: 'Pitch B' },
  { turf_id: 'turf-source', turf_name: 'Pitch A' },
];

// Backlog A-14: copy another pitch's details onto this one.
describe('Manage Turf — Copy Details From Another Pitch (backlog A-14)', () => {
  beforeEach(() => {
    mockGetOwnerTurf.mockReset().mockResolvedValue(TARGET_TURF);
    mockListAvailabilityBlocks.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfPricing.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfOperatingHours.mockReset().mockResolvedValue({ results: [] });
    mockGetMyTurfs.mockReset().mockResolvedValue({ results: OTHER_TURFS });
    mockCopyTurfDetails.mockReset();
  });

  it('lists the owner’s other pitches to copy from, excluding this one', async () => {
    const { findByTestId, queryByTestId } = await render(<ManageTurfScreen />);

    expect(await findByTestId('copy-from-turf-select')).toBeTruthy();
    expect(queryByTestId('copy-from-turf-select-turf-target')).toBeNull();
  });

  it('copies details from the selected pitch and reloads', async () => {
    mockCopyTurfDetails.mockResolvedValueOnce({ ...TARGET_TURF, description: 'copied' });
    const { findByTestId } = await render(<ManageTurfScreen />);

    await findByTestId('copy-from-turf-select');
    fireEvent.press(await findByTestId('copy-from-turf-select-turf-source'));
    fireEvent.press(await findByTestId('copy-turf-details'));

    await waitFor(() =>
      expect(mockCopyTurfDetails).toHaveBeenCalledWith('turf-target', 'turf-source'),
    );
    await waitFor(() => expect(mockGetOwnerTurf).toHaveBeenCalledTimes(2));
  });

  it('does not show the copy section when there are no other pitches', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [TARGET_TURF] });
    const { findByTestId, queryByTestId } = await render(<ManageTurfScreen />);

    await findByTestId('save-turf-details');
    expect(queryByTestId('copy-from-turf-select')).toBeNull();
  });

  it('shows the backend error instead of silently failing', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    mockCopyTurfDetails.mockRejectedValueOnce(new BFAMApiError('Could not copy details.', 409));

    const { findByTestId, findByText } = await render(<ManageTurfScreen />);
    await findByTestId('copy-from-turf-select');
    fireEvent.press(await findByTestId('copy-from-turf-select-turf-source'));
    fireEvent.press(await findByTestId('copy-turf-details'));

    expect(await findByText('Could not copy details.')).toBeTruthy();
  });
});
