import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useParams: () => ({ matchId: 'm1' }),
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getLiveScore: jest.fn(), getGameRoom: jest.fn() },
}));

const mockOn = jest.fn();
const mockOff = jest.fn();
const mockEmit = jest.fn();
jest.mock('../src/lib/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff, emit: mockEmit }),
  joinMatchRoom: jest.fn(),
  leaveMatchRoom: jest.fn(),
}));

import { apiClient } from '../src/lib/apiClient';
import ScoreboardDisplayPage from '../src/app/owner/scoreboard/[matchId]/page';

const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;
const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;

const baseRoom = {
  match_id: 'm1',
  match_name: 'Sunday Friendlies',
  match_status: 'IN_PROGRESS',
  players: [
    { player_id: 'p1', bfam_id: 'BFAM001', full_name: 'Rohan Shah' },
    { player_id: 'p2', bfam_id: 'BFAM002', full_name: null },
    { player_id: 'p3', bfam_id: 'BFAM003', full_name: 'Kabir Mehta' },
  ],
};

// Full-screen LED/TV display (PRD §12.20) — the second half of the founder's
// spec: this must re-fetch on socket events since nobody re-focuses a screen
// wired to a pitch's LED for the whole match.
describe('Owner Web Scoreboard display (PRD §12.20)', () => {
  beforeEach(() => {
    mockGetLiveScore.mockReset();
    mockGetGameRoom.mockReset();
    mockOn.mockReset();
    mockOff.mockReset();
  });

  it('shows the live score, overs, and player names once loaded', async () => {
    mockGetLiveScore.mockResolvedValueOnce({
      match_id: 'm1',
      innings: { total_runs: 88, total_wickets: 3, overs_completed: 12.4, target_runs: null },
      current_striker_player_id: 'p1',
      current_non_striker_player_id: 'p2',
      current_bowler_player_id: 'p3',
    });
    mockGetGameRoom.mockResolvedValueOnce(baseRoom);

    render(<ScoreboardDisplayPage />);

    expect(await screen.findByText('88/3')).toBeInTheDocument();
    expect(await screen.findByText('12.4 overs')).toBeInTheDocument();
    expect(await screen.findByText('Rohan Shah*')).toBeInTheDocument();
    expect(await screen.findByText('BFAM002')).toBeInTheDocument();
    expect(await screen.findByText('Kabir Mehta')).toBeInTheDocument();
  });

  it('shows a waiting message when the innings has not started', async () => {
    mockGetLiveScore.mockResolvedValueOnce({ match_id: 'm1', innings: null });
    mockGetGameRoom.mockResolvedValueOnce({ ...baseRoom, match_status: 'CONFIRMED' });

    render(<ScoreboardDisplayPage />);

    expect(await screen.findByTestId('scoreboard-no-innings')).toBeInTheDocument();
  });

  it('subscribes to match:score_update and match:intro_stage for unattended updates', async () => {
    mockGetLiveScore.mockResolvedValueOnce({ match_id: 'm1', innings: null });
    mockGetGameRoom.mockResolvedValueOnce(baseRoom);

    render(<ScoreboardDisplayPage />);

    await screen.findByTestId('scoreboard-display');
    const subscribedEvents = mockOn.mock.calls.map((call) => call[0]);
    expect(subscribedEvents).toContain('match:score_update');
    expect(subscribedEvents).toContain('match:intro_stage');
  });
});
