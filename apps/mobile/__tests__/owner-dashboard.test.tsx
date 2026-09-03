import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getMyTurfs: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGetMyTurfs = apiClient.getMyTurfs as jest.Mock;

import { OwnerDashboard } from '../src/screens/OwnerDashboard';

describe('OwnerDashboard (module 2.12, PRD §8.3)', () => {
  beforeEach(() => {
    mockGetMyTurfs.mockReset();
    mockPush.mockReset();
  });

  it('loads and lists the owner’s turfs on mount', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({
      results: [
        { turf_id: 't1', turf_name: 'Redline Turf Arena', city: 'Rajkot', turf_status: 'ACTIVE' },
        {
          turf_id: 't2',
          turf_name: 'Green Park Box Cricket',
          city: 'Rajkot',
          turf_status: 'ACTIVE',
        },
      ],
    });

    const { findByText } = render(<OwnerDashboard />);

    expect(await findByText('Redline Turf Arena')).toBeTruthy();
    expect(await findByText('Green Park Box Cricket')).toBeTruthy();
  });

  it('shows an empty state when the owner has no turfs yet', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = render(<OwnerDashboard />);
    expect(await findByTestId('owner-turfs-empty')).toBeTruthy();
  });

  it('navigates to the turf management screen when a turf card is pressed', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({
      results: [
        { turf_id: 't1', turf_name: 'Redline Turf Arena', city: 'Rajkot', turf_status: 'ACTIVE' },
      ],
    });

    const { findByTestId } = render(<OwnerDashboard />);
    const card = await findByTestId('turf-card-t1');
    fireEvent.press(card);

    expect(mockPush).toHaveBeenCalledWith('/owner-turfs/t1');
  });

  it('every quick link navigates to its own screen', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = render(<OwnerDashboard />);
    await waitFor(() => expect(mockGetMyTurfs).toHaveBeenCalled());

    fireEvent.press(await findByTestId('quick-link-bookings'));
    expect(mockPush).toHaveBeenCalledWith('/owner-bookings');

    fireEvent.press(await findByTestId('quick-link-matches'));
    expect(mockPush).toHaveBeenCalledWith('/owner-matches');

    fireEvent.press(await findByTestId('quick-link-staff'));
    expect(mockPush).toHaveBeenCalledWith('/owner-staff');

    fireEvent.press(await findByTestId('quick-link-payments'));
    expect(mockPush).toHaveBeenCalledWith('/owner-payments');
  });
});
