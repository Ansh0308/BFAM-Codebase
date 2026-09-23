import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useParams: () => ({ turfId: 'turf-1' }),
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getOwnerTurf: jest.fn(),
    listAvailabilityBlocks: jest.fn(),
    getTurfPricing: jest.fn(),
    getTurfOperatingHours: jest.fn(),
    setTurfOperatingHours: jest.fn(),
    getMyVenues: jest.fn(),
    getMyTurfs: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import ManageTurfPage from '../src/app/owner/turfs/[turfId]/page';

const mockGetOwnerTurf = apiClient.getOwnerTurf as jest.Mock;
const mockListAvailabilityBlocks = apiClient.listAvailabilityBlocks as jest.Mock;
const mockGetTurfPricing = apiClient.getTurfPricing as jest.Mock;
const mockGetTurfOperatingHours = apiClient.getTurfOperatingHours as jest.Mock;
const mockGetMyTurfs = apiClient.getMyTurfs as jest.Mock;
const mockSetTurfOperatingHours = apiClient.setTurfOperatingHours as jest.Mock;

const TURF = {
  turf_id: 'turf-1',
  owner_id: 'owner-1',
  turf_name: 'BFAM Ground',
  address_line: '123 Main St',
  city: 'Rajkot',
  latitude: 0,
  longitude: 0,
  ball_types_supported: ['TENNIS'],
  stadium_sound_enabled: true,
  turf_status: 'ACTIVE',
  venue_id: null,
};

// Backlog A-13: a default-hours quick-fill so an owner doesn't have to
// type the same open/close pair into all 7 day rows one at a time.
describe('Owner Web — Operating Hours default (backlog A-13)', () => {
  beforeEach(() => {
    mockGetOwnerTurf.mockReset().mockResolvedValue(TURF);
    mockListAvailabilityBlocks.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfPricing.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfOperatingHours.mockReset().mockResolvedValue({ results: [] });
    mockGetMyTurfs.mockReset().mockResolvedValue({ results: [] });
    mockSetTurfOperatingHours.mockReset().mockResolvedValue({ results: [] });
  });

  it('fills every day with the default open/close time in one click', async () => {
    render(<ManageTurfPage />);
    await screen.findByText('Apply a Default to Every Day');

    const opens = screen.getAllByPlaceholderText('06:00') as HTMLInputElement[];
    const closes = screen.getAllByPlaceholderText('23:00') as HTMLInputElement[];
    fireEvent.change(opens[0], { target: { value: '07:00' } });
    fireEvent.change(closes[0], { target: { value: '21:00' } });
    fireEvent.click(screen.getByText('Apply to All Days'));

    for (let i = 1; i <= 7; i++) {
      expect(opens[i].value).toBe('07:00');
      expect(closes[i].value).toBe('21:00');
    }
  });

  it('still allows overriding one specific day after applying the default, and saves the merged result', async () => {
    render(<ManageTurfPage />);
    await screen.findByText('Apply a Default to Every Day');

    const opens = screen.getAllByPlaceholderText('06:00') as HTMLInputElement[];
    const closes = screen.getAllByPlaceholderText('23:00') as HTMLInputElement[];
    fireEvent.change(opens[0], { target: { value: '07:00' } });
    fireEvent.change(closes[0], { target: { value: '21:00' } });
    fireEvent.click(screen.getByText('Apply to All Days'));

    // Sunday (first per-day row) closes earlier than every other day.
    fireEvent.change(closes[1], { target: { value: '18:00' } });
    fireEvent.click(screen.getByText('Save Operating Hours'));

    await waitFor(() =>
      expect(mockSetTurfOperatingHours).toHaveBeenCalledWith(
        'turf-1',
        expect.arrayContaining([
          { day_of_week: 0, open_time: '07:00', close_time: '18:00' },
          { day_of_week: 1, open_time: '07:00', close_time: '21:00' },
        ]),
      ),
    );
  });
});
