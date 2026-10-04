import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getAuditLogs: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminAuditPage from '../src/app/admin/audit/page';

const getAuditLogs = apiClient.getAuditLogs as jest.Mock;

const entry = (id: string, action: string, over: Record<string, unknown> = {}) => ({
  log_id: id,
  actor_user_id: 'a',
  actor_role: 'ADMIN',
  actor_phone: '+919999999999',
  action,
  resource_type: 'booking',
  resource_id: 'abcdef12-3456',
  before_data: { booking_status: 'CONFIRMED' },
  after_data: { booking_status: 'CANCELLED', cancellation_reason: 'Pitch flooded' },
  created_at: new Date().toISOString(),
  ...over,
});

describe('Admin Web — Audit log (backlog G-24)', () => {
  beforeEach(() => getAuditLogs.mockReset());

  it('lists entries in plain words', async () => {
    getAuditLogs.mockResolvedValue({ results: [entry('l1', 'BOOKING_CANCELLED')], total: 1 });
    render(<AdminAuditPage />);
    expect(await screen.findByText('Booking cancelled')).toBeInTheDocument();
  });

  it('shows what changed when a row is opened', async () => {
    getAuditLogs.mockResolvedValue({ results: [entry('l1', 'BOOKING_CANCELLED')], total: 1 });
    render(<AdminAuditPage />);

    fireEvent.click(await screen.findByText('Booking cancelled'));
    const detail = await screen.findByTestId('audit-detail');
    expect(detail).toHaveTextContent('CONFIRMED');
    expect(detail).toHaveTextContent('CANCELLED');
    expect(detail).toHaveTextContent('Pitch flooded');
  });

  it('asks the server for the chosen area and resets to the first page', async () => {
    getAuditLogs.mockResolvedValue({ results: [], total: 0 });
    render(<AdminAuditPage />);
    await waitFor(() => expect(getAuditLogs).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('audit-resource'), { target: { value: 'promo_code' } });
    await waitFor(() =>
      expect(getAuditLogs).toHaveBeenLastCalledWith({
        resource_type: 'promo_code',
        limit: 25,
        offset: 0,
      }),
    );
  });

  it('pages through older entries', async () => {
    getAuditLogs.mockResolvedValue({ results: [entry('l1', 'BOOKING_CANCELLED')], total: 60 });
    render(<AdminAuditPage />);

    fireEvent.click(await screen.findByTestId('audit-next'));
    await waitFor(() => expect(getAuditLogs).toHaveBeenLastCalledWith({ limit: 25, offset: 25 }));
    expect(screen.getByTestId('audit-prev')).not.toBeDisabled();
  });

  it('hides the pager when everything fits on one page', async () => {
    getAuditLogs.mockResolvedValue({ results: [entry('l1', 'BOOKING_CANCELLED')], total: 1 });
    render(<AdminAuditPage />);
    await screen.findByText('Booking cancelled');
    expect(screen.queryByTestId('audit-pager')).not.toBeInTheDocument();
  });

  it('shows an empty state with no entries', async () => {
    getAuditLogs.mockResolvedValue({ results: [], total: 0 });
    render(<AdminAuditPage />);
    expect(await screen.findByTestId('audit-empty')).toBeInTheDocument();
  });
});
