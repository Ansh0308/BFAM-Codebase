import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAllTeamsAdmin: jest.fn(),
    setTeamStatusAdmin: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminTeamsPage from '../src/app/admin/teams/page';

const mockGetAllTeamsAdmin = apiClient.getAllTeamsAdmin as jest.Mock;
const mockSetTeamStatusAdmin = apiClient.setTeamStatusAdmin as jest.Mock;

const TEAM = {
  team_id: 't1',
  team_name: 'Thunder Strikers',
  home_city: 'Rajkot',
  skill_level: 'INTERMEDIATE',
  team_status: 'ACTIVE' as const,
  captain_name: 'Karan Captain',
  captain_phone: '+919900000001',
  member_count: 8,
  created_at: '2026-01-01T00:00:00.000Z',
};

// Backlog E-4: Team Management in Admin Web — a cross-captain directory
// with archive/reactivate moderation.
describe('Admin Teams page (backlog E-4)', () => {
  beforeEach(() => {
    mockGetAllTeamsAdmin.mockReset();
    mockSetTeamStatusAdmin.mockReset();
  });

  it('shows every team with its captain, member count, and status', async () => {
    mockGetAllTeamsAdmin.mockResolvedValueOnce({ results: [TEAM] });

    render(<AdminTeamsPage />);

    expect(await screen.findByText('Thunder Strikers')).toBeInTheDocument();
    expect(screen.getByText('Karan Captain')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('falls back to the captain phone number when a team has no captain full_name set', async () => {
    mockGetAllTeamsAdmin.mockResolvedValueOnce({
      results: [{ ...TEAM, captain_name: null }],
    });

    render(<AdminTeamsPage />);

    expect(await screen.findByText('+919900000001')).toBeInTheDocument();
  });

  it('can search teams by name, city, or captain', async () => {
    mockGetAllTeamsAdmin.mockResolvedValueOnce({
      results: [
        TEAM,
        {
          ...TEAM,
          team_id: 't2',
          team_name: 'River Rebels',
          home_city: 'Ahmedabad',
          captain_name: 'Meena Captain',
        },
      ],
    });

    render(<AdminTeamsPage />);
    await screen.findByText('Thunder Strikers');

    fireEvent.change(screen.getByPlaceholderText(/team name, city, or captain/i), {
      target: { value: 'river' },
    });

    await waitFor(() => expect(screen.queryByText('Thunder Strikers')).not.toBeInTheDocument());
    expect(screen.getByText('River Rebels')).toBeInTheDocument();
  });

  it('archives an active team and reloads the list', async () => {
    mockGetAllTeamsAdmin
      .mockResolvedValueOnce({ results: [TEAM] })
      .mockResolvedValueOnce({ results: [{ ...TEAM, team_status: 'ARCHIVED' }] });
    mockSetTeamStatusAdmin.mockResolvedValueOnce({ ...TEAM, team_status: 'ARCHIVED' });

    render(<AdminTeamsPage />);
    await screen.findByText('Thunder Strikers');

    fireEvent.click(screen.getByText('Archive'));

    await waitFor(() => expect(mockSetTeamStatusAdmin).toHaveBeenCalledWith('t1', 'ARCHIVED'));
    expect(await screen.findByText('ARCHIVED')).toBeInTheDocument();
  });

  it('reactivates an archived team', async () => {
    mockGetAllTeamsAdmin
      .mockResolvedValueOnce({ results: [{ ...TEAM, team_status: 'ARCHIVED' }] })
      .mockResolvedValueOnce({ results: [{ ...TEAM, team_status: 'ACTIVE' }] });
    mockSetTeamStatusAdmin.mockResolvedValueOnce({ ...TEAM, team_status: 'ACTIVE' });

    render(<AdminTeamsPage />);
    await screen.findByText('Thunder Strikers');

    fireEvent.click(screen.getByText('Reactivate'));

    await waitFor(() => expect(mockSetTeamStatusAdmin).toHaveBeenCalledWith('t1', 'ACTIVE'));
  });
});
