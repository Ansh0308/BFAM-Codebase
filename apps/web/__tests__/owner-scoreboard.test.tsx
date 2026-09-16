import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getOwnerLiveMatches: jest.fn(),
    getLiveScore: jest.fn(),
    getGameRoom: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerScoreboardPage from '../src/app/owner/scoreboard/page';

const mockGetOwnerLiveMatches = apiClient.getOwnerLiveMatches as jest.Mock;

// Digital Scoreboard picker (PRD §12.20, backlog item raised directly by
// the founder — LED/TV per pitch, driven from an owner-web PC).
describe('Owner Web Scoreboard picker (PRD §12.20)', () => {
  beforeEach(() => {
    mockGetOwnerLiveMatches.mockReset();
  });

  it('shows an empty state when nothing is live', async () => {
    mockGetOwnerLiveMatches.mockResolvedValueOnce({ results: [] });
    render(<OwnerScoreboardPage />);
    expect(await screen.findByTestId('scoreboard-empty')).toBeInTheDocument();
  });

  it('groups live matches by turf so an owner can tell which pitch each maps to', async () => {
    mockGetOwnerLiveMatches.mockResolvedValueOnce({
      results: [
        {
          match_id: 'm1',
          match_name: 'Sunday Friendlies',
          turf_id: 't1',
          turf_name: 'Pitch 1',
          venue_name: 'Redline Sports Complex',
          total_runs: 42,
          total_wickets: 2,
          overs_completed: 6.3,
        },
        {
          match_id: 'm2',
          match_name: 'Night League',
          turf_id: 't2',
          turf_name: 'Pitch 2',
          venue_name: 'Redline Sports Complex',
          total_runs: 10,
          total_wickets: 0,
          overs_completed: 1.2,
        },
      ],
    });

    render(<OwnerScoreboardPage />);

    expect(await screen.findByText(/^Pitch 1/)).toBeInTheDocument();
    expect(await screen.findByText(/^Pitch 2/)).toBeInTheDocument();
    expect(await screen.findByText('Sunday Friendlies')).toBeInTheDocument();
    expect(await screen.findByText(/42\/2/)).toBeInTheDocument();

    await waitFor(() => expect(mockGetOwnerLiveMatches).toHaveBeenCalled());
  });

  it('keeps same-named pitches at different venues in separate groups', async () => {
    mockGetOwnerLiveMatches.mockResolvedValueOnce({
      results: [
        {
          match_id: 'm1',
          match_name: 'Sunday Friendlies',
          turf_id: 't1',
          turf_name: 'Pitch 1',
          venue_name: 'Redline Sports Complex',
          total_runs: 42,
          total_wickets: 2,
          overs_completed: 6.3,
        },
        {
          match_id: 'm2',
          match_name: 'Night League',
          turf_id: 't2',
          turf_name: 'Pitch 1',
          venue_name: 'Downtown Arena',
          total_runs: 10,
          total_wickets: 0,
          overs_completed: 1.2,
        },
      ],
    });

    render(<OwnerScoreboardPage />);

    expect(await screen.findAllByTestId('scoreboard-turf-group')).toHaveLength(2);
    expect(await screen.findByText('Pitch 1 · Redline Sports Complex')).toBeInTheDocument();
    expect(await screen.findByText('Pitch 1 · Downtown Arena')).toBeInTheDocument();
  });

  it('links each live match to its full-screen display page', async () => {
    mockGetOwnerLiveMatches.mockResolvedValueOnce({
      results: [
        {
          match_id: 'm1',
          match_name: 'Sunday Friendlies',
          turf_id: 't1',
          turf_name: 'Pitch 1',
          venue_name: null,
          total_runs: 42,
          total_wickets: 2,
          overs_completed: 6.3,
        },
      ],
    });

    render(<OwnerScoreboardPage />);

    const openLink = await screen.findByTestId('scoreboard-open-display');
    expect(openLink).toHaveAttribute('href', '/owner/scoreboard/m1');
  });
});
