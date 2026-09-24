import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getBusinessReport: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminReportsPage from '../src/app/admin/reports/page';

const mockGetBusinessReport = apiClient.getBusinessReport as jest.Mock;

const REPORT = {
  total_bookings: 100,
  cancelled_bookings: 15,
  cancellation_rate: 15,
  total_revenue: 500000,
  total_refunds: 12000,
  active_players: 250,
  active_turfs: 20,
  active_teams: 30,
  matches_completed: 80,
};

// Backlog E-6: Reports / Business Analytics in Admin Web.
describe('Admin Reports page (backlog E-6)', () => {
  beforeEach(() => {
    mockGetBusinessReport.mockReset();
  });

  it('shows every KPI tile from the report', async () => {
    mockGetBusinessReport.mockResolvedValueOnce(REPORT);

    render(<AdminReportsPage />);

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('₹500000')).toBeInTheDocument();
    expect(screen.getByText('₹12000')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows an error message when the report fails to load', async () => {
    mockGetBusinessReport.mockRejectedValueOnce(new Error('network down'));

    render(<AdminReportsPage />);

    expect(await screen.findByText(/could not load the report/i)).toBeInTheDocument();
  });
});
