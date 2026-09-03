import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getMyTurfs: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerDashboardPage from '../src/app/owner/page';

const mockGetMyTurfs = apiClient.getMyTurfs as jest.Mock;

describe('Owner Web Dashboard (module 2.12, PRD §9.2)', () => {
  beforeEach(() => {
    mockGetMyTurfs.mockReset();
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

    render(<OwnerDashboardPage />);

    expect(await screen.findByText('Redline Turf Arena')).toBeInTheDocument();
    expect(await screen.findByText('Green Park Box Cricket')).toBeInTheDocument();
  });

  it('shows an empty state when the owner has no turfs yet', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    render(<OwnerDashboardPage />);
    expect(await screen.findByTestId('owner-turfs-empty')).toBeInTheDocument();
  });

  it('links each turf card to its management page', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({
      results: [
        { turf_id: 't1', turf_name: 'Redline Turf Arena', city: 'Rajkot', turf_status: 'ACTIVE' },
      ],
    });
    render(<OwnerDashboardPage />);
    await waitFor(() => expect(mockGetMyTurfs).toHaveBeenCalled());

    const link = (await screen.findByTestId('turf-card-t1')).closest('a');
    expect(link).toHaveAttribute('href', '/owner/turfs/t1');
  });

  it('the Add Turf action links to the create-turf page', async () => {
    mockGetMyTurfs.mockResolvedValueOnce({ results: [] });
    render(<OwnerDashboardPage />);
    await waitFor(() => expect(mockGetMyTurfs).toHaveBeenCalled());

    const addTurfLink = screen.getByText(/add turf/i).closest('a');
    expect(addTurfLink).toHaveAttribute('href', '/owner/turfs/new');
  });
});
