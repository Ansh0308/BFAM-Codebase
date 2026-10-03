import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getStaffMatches: jest.fn(),
    getGameRoom: jest.fn(),
    setPlayerAttendance: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import StaffMatchesPage from '../src/app/staff/matches/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const MATCH = (id: string, status: string, name: string) => ({
  match_id: id,
  booking_id: 'b1',
  match_name: name,
  match_status: status,
  turf_name: 'Redline Turf Arena',
  overs_per_innings: 6,
  scheduled_start_time: '2099-01-01T18:00:00Z',
});

describe('Staff Web — Match Operations (module 2.12)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it('lists matches and filters to live ones', async () => {
    api.getStaffMatches.mockResolvedValue({
      results: [MATCH('m1', 'IN_PROGRESS', 'Final Over'), MATCH('m2', 'COMPLETED', 'Old Game')],
    });
    render(<StaffMatchesPage />);

    expect(await screen.findByText('Final Over')).toBeInTheDocument();
    expect(screen.getByText('Old Game')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('match-filter-live'));
    await waitFor(() => expect(screen.queryByText('Old Game')).not.toBeInTheDocument());
    expect(screen.getByText('Final Over')).toBeInTheDocument();
  });

  it('shows an empty state when there are no matches', async () => {
    api.getStaffMatches.mockResolvedValue({ results: [] });
    render(<StaffMatchesPage />);

    expect(await screen.findByText('No matches yet at your assigned turf(s).')).toBeInTheDocument();
  });

  it('opens a roster and checks a player in', async () => {
    api.getStaffMatches.mockResolvedValue({ results: [MATCH('m1', 'CONFIRMED', 'Evening Smash')] });
    api.getGameRoom.mockResolvedValue({
      players: [
        {
          player_id: 'p1',
          participant_role: 'PLAYER',
          attendance_status: 'PENDING',
          bfam_id: 'BF1001',
          full_name: 'Asha Patel',
        },
      ],
    });
    api.setPlayerAttendance.mockResolvedValue(undefined);
    render(<StaffMatchesPage />);

    fireEvent.click(await screen.findByTestId('open-roster-m1'));
    expect(await screen.findByText('Asha Patel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('checkin-p1'));
    await waitFor(() =>
      expect(api.setPlayerAttendance).toHaveBeenCalledWith('m1', 'p1', 'CHECKED_IN'),
    );
  });
});
