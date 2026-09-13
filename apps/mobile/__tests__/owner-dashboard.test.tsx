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

    const { findByText } = await render(<OwnerDashboard />);

    expect(await findByText('Redline Turf Arena')).toBeTruthy();
    expect(await findByText('Green Park Box Cricket')).toBeTruthy();
  });

  it('shows an empty state when the owner has no turfs yet', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<OwnerDashboard />);
    expect(await findByTestId('owner-turfs-empty')).toBeTruthy();
  });

  it('navigates to the turf management screen when a turf card is pressed', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({
      results: [
        { turf_id: 't1', turf_name: 'Redline Turf Arena', city: 'Rajkot', turf_status: 'ACTIVE' },
      ],
    });

    const { findByTestId } = await render(<OwnerDashboard />);
    const card = await findByTestId('turf-card-t1');
    await fireEvent.press(card);

    expect(mockPush).toHaveBeenCalledWith('/owner-turfs/t1');
  });

  it('the Add Turf action links to the combined venue+pitches create screen (feedback follow-up)', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<OwnerDashboard />);
    await fireEvent.press(await findByTestId('add-turf-button'));
    expect(mockPush).toHaveBeenCalledWith('/owner-venues/create');
  });

  it('groups pitches that share a venue under one card (backlog A-2)', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({
      results: [
        {
          turf_id: 't1',
          turf_name: 'Pitch 1',
          city: 'Rajkot',
          turf_status: 'ACTIVE',
          venue_id: 'v1',
          venue_name: 'Redline Sports Complex',
        },
        {
          turf_id: 't2',
          turf_name: 'Pitch 2',
          city: 'Rajkot',
          turf_status: 'ACTIVE',
          venue_id: 'v1',
          venue_name: 'Redline Sports Complex',
        },
        {
          turf_id: 't3',
          turf_name: 'Solo Turf',
          city: 'Rajkot',
          turf_status: 'ACTIVE',
          venue_id: null,
        },
      ],
    });

    const { findByTestId, findByText, queryByTestId } = await render(<OwnerDashboard />);

    expect(await findByTestId('venue-card-v1')).toBeTruthy();
    expect(await findByText('Redline Sports Complex')).toBeTruthy();
    expect(await findByText('2 pitches')).toBeTruthy();
    expect(await findByTestId('turf-card-t3')).toBeTruthy();
    expect(queryByTestId('turf-card-t1')).toBeNull();

    await fireEvent.press(await findByTestId('venue-card-v1'));
    expect(mockPush).toHaveBeenCalledWith('/owner-venues/v1');
  });

  it('every quick link navigates to its own screen', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<OwnerDashboard />);
    await waitFor(() => expect(mockGetMyTurfs).toHaveBeenCalled());

    await fireEvent.press(await findByTestId('quick-link-bookings'));
    expect(mockPush).toHaveBeenCalledWith('/owner-bookings');

    await fireEvent.press(await findByTestId('quick-link-matches'));
    expect(mockPush).toHaveBeenCalledWith('/owner-matches');

    await fireEvent.press(await findByTestId('quick-link-staff'));
    expect(mockPush).toHaveBeenCalledWith('/owner-staff');

    await fireEvent.press(await findByTestId('quick-link-payments'));
    expect(mockPush).toHaveBeenCalledWith('/owner-payments');
  });
});
