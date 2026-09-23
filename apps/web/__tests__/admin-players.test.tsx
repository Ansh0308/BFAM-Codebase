import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAllPlayers: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminPlayersPage from '../src/app/admin/players/page';

const mockGetAllPlayers = apiClient.getAllPlayers as jest.Mock;

const PLAYER = {
  user_id: 'u1',
  bfam_id: 'BF1001',
  full_name: 'Asha Patel',
  phone_number: '+919900000001',
  email: null,
  city: 'Rajkot',
  account_status: 'ACTIVE',
  playing_role: 'BATTER',
  batting_style: null,
  experience_level: 'INTERMEDIATE',
  skill_rating: 600,
  reliability_score: 95,
  favorite_cricketer_name: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

// Backlog A-18: name-instead-of-BFAM-ID — the admin player directory only
// ever showed a raw BFAM ID column, with no name anywhere.
describe('Admin Players page — shows names, not just BFAM IDs (backlog A-18)', () => {
  beforeEach(() => {
    mockGetAllPlayers.mockReset();
  });

  it('shows the player name alongside the BFAM ID', async () => {
    mockGetAllPlayers.mockResolvedValueOnce({ results: [PLAYER] });

    render(<AdminPlayersPage />);

    expect(await screen.findByText('Asha Patel')).toBeInTheDocument();
    expect(await screen.findByText('BF1001')).toBeInTheDocument();
  });

  it('falls back to an em dash when a player has no full_name set', async () => {
    mockGetAllPlayers.mockResolvedValueOnce({ results: [{ ...PLAYER, full_name: null }] });

    render(<AdminPlayersPage />);

    await screen.findByText('BF1001');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('can search players by name, not just BFAM ID', async () => {
    mockGetAllPlayers.mockResolvedValueOnce({
      results: [PLAYER, { ...PLAYER, user_id: 'u2', bfam_id: 'BF1002', full_name: 'Rohan Mehta' }],
    });

    render(<AdminPlayersPage />);
    await screen.findByText('Asha Patel');

    fireEvent.change(screen.getByPlaceholderText(/name, bfam id/i), {
      target: { value: 'rohan' },
    });

    await waitFor(() => expect(screen.queryByText('Asha Patel')).not.toBeInTheDocument());
    expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
  });
});
