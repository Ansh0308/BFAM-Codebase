import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useParams: () => ({ turfId: 'turf-target' }),
}));

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

import { apiClient } from '../src/lib/apiClient';
import ManageTurfPage from '../src/app/owner/turfs/[turfId]/page';

const mockGetOwnerTurf = apiClient.getOwnerTurf as jest.Mock;
const mockListAvailabilityBlocks = apiClient.listAvailabilityBlocks as jest.Mock;
const mockGetTurfPricing = apiClient.getTurfPricing as jest.Mock;
const mockGetTurfOperatingHours = apiClient.getTurfOperatingHours as jest.Mock;
const mockGetMyTurfs = apiClient.getMyTurfs as jest.Mock;
const mockCopyTurfDetails = apiClient.copyTurfDetails as jest.Mock;

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
describe('Owner Web — Copy Details From Another Pitch (backlog A-14)', () => {
  beforeEach(() => {
    mockGetOwnerTurf.mockReset().mockResolvedValue(TARGET_TURF);
    mockListAvailabilityBlocks.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfPricing.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfOperatingHours.mockReset().mockResolvedValue({ results: [] });
    mockGetMyTurfs.mockReset().mockResolvedValue({ results: OTHER_TURFS });
    mockCopyTurfDetails.mockReset();
  });

  it('lists the owner’s other pitches to copy from, excluding this one', async () => {
    render(<ManageTurfPage />);

    expect(await screen.findByText('Copy Details From Another Pitch')).toBeInTheDocument();
    const picker = await screen.findByTestId('copy-from-turf-select');
    expect(picker).toHaveTextContent('Pitch A');
    expect(picker).not.toHaveTextContent('Pitch B');
  });

  it('copies details from the selected pitch and reloads', async () => {
    mockCopyTurfDetails.mockResolvedValueOnce({ ...TARGET_TURF, description: 'copied' });
    render(<ManageTurfPage />);

    fireEvent.click(await screen.findByText('Pitch A'));
    fireEvent.click(screen.getByText('Copy Details'));

    await waitFor(() =>
      expect(mockCopyTurfDetails).toHaveBeenCalledWith('turf-target', 'turf-source'),
    );
    await waitFor(() => expect(mockGetOwnerTurf).toHaveBeenCalledTimes(2));
  });

  it('does not show the copy section when there are no other pitches', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [TARGET_TURF] });
    render(<ManageTurfPage />);

    await screen.findByText('Save Details');
    expect(screen.queryByText('Copy Details From Another Pitch')).not.toBeInTheDocument();
  });

  it('shows the backend error instead of silently failing', async () => {
    const { BFAMApiError } = jest.requireActual('../src/lib/auth');
    mockCopyTurfDetails.mockRejectedValueOnce(new BFAMApiError('Could not copy details.', 409));

    render(<ManageTurfPage />);
    fireEvent.click(await screen.findByText('Pitch A'));
    fireEvent.click(screen.getByText('Copy Details'));

    expect(await screen.findByText('Could not copy details.')).toBeInTheDocument();
  });
});
