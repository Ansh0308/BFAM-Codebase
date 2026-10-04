import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getAdminOverview: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminOverviewPage from '../src/app/admin/page';

const getAdminOverview = apiClient.getAdminOverview as jest.Mock;

const OVERVIEW = {
  users: { players: 120, owners: 8, staff: 14, new_players_7d: 9 },
  turfs: { active: 6, total: 7 },
  bookings: { today: 11, last_7_days: 64 },
  revenue: { last_30_days: 184000 },
  matches: { live: 2, upcoming: 5 },
  support: { open: 3, in_progress: 1 },
  bfam_ids: { locked: 4 },
  recent_activity: [
    {
      log_id: 'l1',
      actor_user_id: 'a',
      actor_role: 'ADMIN',
      actor_phone: '+919999999999',
      action: 'SUPPORT_TICKET_STATUS_CHANGED',
      resource_type: 'support_ticket',
      resource_id: 'abcdef12-0000',
      before_data: null,
      after_data: null,
      created_at: new Date().toISOString(),
    },
  ],
};

const settled = (testId: string) =>
  screen.getByTestId(testId).querySelector('[data-value]')?.getAttribute('data-value');

describe('Admin Web — Overview (PRD §30.10)', () => {
  beforeEach(() => getAdminOverview.mockReset());

  it('shows the platform totals', async () => {
    getAdminOverview.mockResolvedValue(OVERVIEW);
    render(<AdminOverviewPage />);

    await screen.findByTestId('stat-players');
    expect(settled('stat-players')).toBe('120');
    expect(settled('stat-active-turfs')).toBe('6');
    expect(settled('stat-revenue-30-days-')).toBe('184000');
    expect(settled('stat-live-matches')).toBe('2');
  });

  it('flags what needs attention and links to the right place', async () => {
    getAdminOverview.mockResolvedValue(OVERVIEW);
    render(<AdminOverviewPage />);

    expect(await screen.findByTestId('attention-open')).toHaveAttribute('href', '/admin/support');
    expect(screen.getByTestId('attention-ids')).toHaveAttribute('href', '/admin/bfam-ids');
  });

  it('lists recent activity in plain words', async () => {
    getAdminOverview.mockResolvedValue(OVERVIEW);
    render(<AdminOverviewPage />);

    expect(await screen.findByText('Support ticket status changed')).toBeInTheDocument();
  });

  it('shows an empty feed state when nothing has happened', async () => {
    getAdminOverview.mockResolvedValue({ ...OVERVIEW, recent_activity: [] });
    render(<AdminOverviewPage />);
    expect(await screen.findByTestId('activity-empty')).toBeInTheDocument();
  });

  it('shows a retry when the overview fails to load', async () => {
    getAdminOverview.mockRejectedValueOnce(new Error('401'));
    getAdminOverview.mockResolvedValueOnce(OVERVIEW);
    render(<AdminOverviewPage />);

    expect(await screen.findByTestId('overview-error')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    await waitFor(() => expect(getAdminOverview).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('stat-players')).toBeInTheDocument();
  });
});
