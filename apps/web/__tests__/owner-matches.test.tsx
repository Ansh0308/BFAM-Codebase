import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getOwnerMatches: jest.fn(), getGameRoom: jest.fn(), setPlayerAttendance: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerMatchesPage from '../src/app/owner/matches/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const match = (id: string, status: string, name: string) => ({
  match_id: id,
  booking_id: 'b1',
  match_name: name,
  match_type: 'FRIENDLY',
  ball_type: 'TENNIS',
  overs_per_innings: 6,
  scoring_mode: 'PLAYER_MANAGED',
  match_status: status,
  turf_name: 'Redline Turf Arena',
  scheduled_start_time: '2099-01-01T18:00:00Z',
});

describe('Owner Web — Match Management (PRD §30.9)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it('lists matches, counts them by state and filters', async () => {
    api.getOwnerMatches.mockResolvedValue({
      results: [match('m1', 'IN_PROGRESS', 'Final Over'), match('m2', 'COMPLETED', 'Old Game')],
    });
    render(<OwnerMatchesPage />);

    expect(await screen.findByText('Final Over')).toBeInTheDocument();
    expect(screen.getByTestId('stat-live-now').querySelector('[data-value]')).toHaveAttribute(
      'data-value',
      '1',
    );

    fireEvent.click(screen.getByTestId('match-filter-finished'));
    await waitFor(() => expect(screen.queryByText('Final Over')).not.toBeInTheDocument());
    expect(screen.getByText('Old Game')).toBeInTheDocument();
  });

  it('shows an empty state with no matches', async () => {
    api.getOwnerMatches.mockResolvedValue({ results: [] });
    render(<OwnerMatchesPage />);
    expect(await screen.findByText('No matches yet at your turfs.')).toBeInTheDocument();
  });

  it('opens a live match with a read-only roster and a scoreboard link', async () => {
    api.getOwnerMatches.mockResolvedValue({ results: [match('m1', 'IN_PROGRESS', 'Final Over')] });
    api.getGameRoom.mockResolvedValue({
      players: [
        {
          player_id: 'p1',
          participant_role: 'PLAYER',
          attendance_status: 'CHECKED_IN',
          bfam_id: 'BF1001',
          full_name: 'Asha Patel',
        },
      ],
    });
    render(<OwnerMatchesPage />);

    fireEvent.click(await screen.findByTestId('open-match-m1'));
    expect(await screen.findByText('Asha Patel')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/owner/scoreboard/m1');
    // Owners view the roster; check-in belongs to staff and organisers.
    expect(screen.queryByTestId('checkin-p1')).not.toBeInTheDocument();
  });
});
