import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAllMatchesAdmin: jest.fn(),
    forceCancelMatchAdmin: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminMatchesPage from '../src/app/admin/matches/page';

const mockGetAllMatchesAdmin = apiClient.getAllMatchesAdmin as jest.Mock;
const mockForceCancelMatchAdmin = apiClient.forceCancelMatchAdmin as jest.Mock;

const MATCH = {
  match_id: 'm1',
  match_name: 'Sunday Showdown',
  match_type: 'FRIENDLY',
  match_status: 'OPEN',
  visibility: 'PUBLIC',
  scheduled_start_time: '2026-09-28T12:00:00.000Z',
  organizer_name: 'Vikram Organizer',
  organizer_phone: '+919900000001',
  turf_name: 'Green Park Box Cricket',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Backlog E-2: Match Management in Admin Web — a cross-organizer
// directory with a force-cancel moderation action.
describe('Admin Matches page (backlog E-2)', () => {
  beforeEach(() => {
    mockGetAllMatchesAdmin.mockReset();
    mockForceCancelMatchAdmin.mockReset();
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it('shows every match with its organizer and turf', async () => {
    mockGetAllMatchesAdmin.mockResolvedValueOnce({ results: [MATCH] });

    render(<AdminMatchesPage />);

    expect(await screen.findByText('Sunday Showdown')).toBeInTheDocument();
    expect(screen.getByText('Vikram Organizer')).toBeInTheDocument();
    expect(screen.getByText('Green Park Box Cricket')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('can search by match name, organizer, or turf', async () => {
    mockGetAllMatchesAdmin.mockResolvedValueOnce({
      results: [
        MATCH,
        { ...MATCH, match_id: 'm2', match_name: 'Weekend Bash', organizer_name: 'Meena Organizer' },
      ],
    });

    render(<AdminMatchesPage />);
    await screen.findByText('Sunday Showdown');

    fireEvent.change(screen.getByPlaceholderText(/match name, organizer, or turf/i), {
      target: { value: 'weekend' },
    });

    await waitFor(() => expect(screen.queryByText('Sunday Showdown')).not.toBeInTheDocument());
    expect(screen.getByText('Weekend Bash')).toBeInTheDocument();
  });

  it('confirms, then force-cancels a match and reloads the list', async () => {
    mockGetAllMatchesAdmin
      .mockResolvedValueOnce({ results: [MATCH] })
      .mockResolvedValueOnce({ results: [{ ...MATCH, match_status: 'CANCELLED' }] });
    mockForceCancelMatchAdmin.mockResolvedValueOnce({ ...MATCH, match_status: 'CANCELLED' });

    render(<AdminMatchesPage />);
    await screen.findByText('Sunday Showdown');

    fireEvent.click(screen.getByText('Force Cancel'));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockForceCancelMatchAdmin).toHaveBeenCalledWith('m1'));
    expect(await screen.findByText('CANCELLED')).toBeInTheDocument();
  });

  it('does not cancel when the confirmation is declined', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    mockGetAllMatchesAdmin.mockResolvedValueOnce({ results: [MATCH] });

    render(<AdminMatchesPage />);
    await screen.findByText('Sunday Showdown');

    fireEvent.click(screen.getByText('Force Cancel'));

    expect(mockForceCancelMatchAdmin).not.toHaveBeenCalled();
  });

  it('hides the Force Cancel action for a completed or cancelled match', async () => {
    mockGetAllMatchesAdmin.mockResolvedValueOnce({
      results: [{ ...MATCH, match_status: 'COMPLETED' }],
    });

    render(<AdminMatchesPage />);
    await screen.findByText('Sunday Showdown');

    expect(screen.queryByText('Force Cancel')).not.toBeInTheDocument();
  });
});
