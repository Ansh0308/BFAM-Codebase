import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getOwnerTurf: jest.fn(),
    listAvailabilityBlocks: jest.fn(),
    getTurfPricing: jest.fn(),
    getTurfOperatingHours: jest.fn(),
    setTurfOperatingHours: jest.fn(),
    getMyVenues: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ turfId: 'turf-1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const mockGetOwnerTurf = apiClient.getOwnerTurf as jest.Mock;
const mockListAvailabilityBlocks = apiClient.listAvailabilityBlocks as jest.Mock;
const mockGetTurfPricing = apiClient.getTurfPricing as jest.Mock;
const mockGetTurfOperatingHours = apiClient.getTurfOperatingHours as jest.Mock;
const mockSetTurfOperatingHours = apiClient.setTurfOperatingHours as jest.Mock;

import ManageTurfScreen from '../app/owner-turfs/[turfId]';

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
describe('Manage Turf — Operating Hours default (backlog A-13)', () => {
  beforeEach(() => {
    mockGetOwnerTurf.mockReset().mockResolvedValue(TURF);
    mockListAvailabilityBlocks.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfPricing.mockReset().mockResolvedValue({ results: [] });
    mockGetTurfOperatingHours.mockReset().mockResolvedValue({ results: [] });
    mockSetTurfOperatingHours.mockReset().mockResolvedValue({ results: [] });
  });

  it('fills every day with the default open/close time in one tap', async () => {
    const { findByTestId } = await render(<ManageTurfScreen />);
    await findByTestId('save-operating-hours');

    fireEvent.changeText(await findByTestId('default-hours-open'), '07:00');
    fireEvent.changeText(await findByTestId('default-hours-close'), '21:00');
    fireEvent.press(await findByTestId('apply-default-hours'));

    for (let day = 0; day < 7; day++) {
      const openField = await findByTestId(`hours-open-${day}`);
      const closeField = await findByTestId(`hours-close-${day}`);
      expect(openField.props.value).toBe('07:00');
      expect(closeField.props.value).toBe('21:00');
    }
  });

  it('still allows overriding one specific day after applying the default', async () => {
    const { findByTestId } = await render(<ManageTurfScreen />);
    await findByTestId('save-operating-hours');

    fireEvent.changeText(await findByTestId('default-hours-open'), '07:00');
    fireEvent.changeText(await findByTestId('default-hours-close'), '21:00');
    fireEvent.press(await findByTestId('apply-default-hours'));

    // Sunday (day 0) closes earlier than every other day.
    fireEvent.changeText(await findByTestId('hours-close-0'), '18:00');
    fireEvent.press(await findByTestId('save-operating-hours'));

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

  it('does nothing if the default fields are left blank', async () => {
    const { findByTestId } = await render(<ManageTurfScreen />);
    await findByTestId('save-operating-hours');

    fireEvent.changeText(await findByTestId('default-hours-open'), '');
    fireEvent.changeText(await findByTestId('default-hours-close'), '');
    fireEvent.press(await findByTestId('apply-default-hours'));

    const mondayOpen = await findByTestId('hours-open-1');
    expect(mondayOpen.props.value).toBe('');
  });
});
