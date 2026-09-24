import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAllTurfsAdmin: jest.fn(),
    setTurfStatusAdmin: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminTurfsPage from '../src/app/admin/turfs/page';

const mockGetAllTurfsAdmin = apiClient.getAllTurfsAdmin as jest.Mock;
const mockSetTurfStatusAdmin = apiClient.setTurfStatusAdmin as jest.Mock;

const TURF = {
  turf_id: 't1',
  turf_name: 'Green Park Box Cricket',
  city: 'Rajkot',
  turf_status: 'ACTIVE' as const,
  average_rating: '4.5',
  owner_id: 'owner-1',
  owner_name: 'Ravi Owner',
  owner_phone: '+919900000001',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Backlog E-3: Turf Management in Admin Web — a cross-owner directory with
// suspend/reactivate moderation.
describe('Admin Turfs page (backlog E-3)', () => {
  beforeEach(() => {
    mockGetAllTurfsAdmin.mockReset();
    mockSetTurfStatusAdmin.mockReset();
  });

  it('shows every turf with its owner and status', async () => {
    mockGetAllTurfsAdmin.mockResolvedValueOnce({ results: [TURF] });

    render(<AdminTurfsPage />);

    expect(await screen.findByText('Green Park Box Cricket')).toBeInTheDocument();
    expect(screen.getByText('Ravi Owner')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('falls back to the owner phone number when a turf owner has no full_name set', async () => {
    mockGetAllTurfsAdmin.mockResolvedValueOnce({
      results: [{ ...TURF, owner_name: null }],
    });

    render(<AdminTurfsPage />);

    expect(await screen.findByText('+919900000001')).toBeInTheDocument();
  });

  it('can search turfs by name, city, or owner', async () => {
    mockGetAllTurfsAdmin.mockResolvedValueOnce({
      results: [
        TURF,
        {
          ...TURF,
          turf_id: 't2',
          turf_name: 'Riverside Turf',
          city: 'Ahmedabad',
          owner_name: 'Meena Owner',
        },
      ],
    });

    render(<AdminTurfsPage />);
    await screen.findByText('Green Park Box Cricket');

    fireEvent.change(screen.getByPlaceholderText(/turf name, city, or owner/i), {
      target: { value: 'riverside' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Green Park Box Cricket')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Riverside Turf')).toBeInTheDocument();
  });

  it('suspends an active turf and reloads the list', async () => {
    mockGetAllTurfsAdmin
      .mockResolvedValueOnce({ results: [TURF] })
      .mockResolvedValueOnce({ results: [{ ...TURF, turf_status: 'SUSPENDED' }] });
    mockSetTurfStatusAdmin.mockResolvedValueOnce({ ...TURF, turf_status: 'SUSPENDED' });

    render(<AdminTurfsPage />);
    await screen.findByText('Green Park Box Cricket');

    fireEvent.click(screen.getByText('Suspend'));

    await waitFor(() => expect(mockSetTurfStatusAdmin).toHaveBeenCalledWith('t1', 'SUSPENDED'));
    expect(await screen.findByText('SUSPENDED')).toBeInTheDocument();
  });

  it('reactivates a suspended turf', async () => {
    mockGetAllTurfsAdmin
      .mockResolvedValueOnce({ results: [{ ...TURF, turf_status: 'SUSPENDED' }] })
      .mockResolvedValueOnce({ results: [{ ...TURF, turf_status: 'ACTIVE' }] });
    mockSetTurfStatusAdmin.mockResolvedValueOnce({ ...TURF, turf_status: 'ACTIVE' });

    render(<AdminTurfsPage />);
    await screen.findByText('Green Park Box Cricket');

    fireEvent.click(screen.getByText('Reactivate'));

    await waitFor(() => expect(mockSetTurfStatusAdmin).toHaveBeenCalledWith('t1', 'ACTIVE'));
  });
});
