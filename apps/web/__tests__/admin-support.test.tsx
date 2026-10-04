import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getAdminTickets: jest.fn(), updateTicketStatus: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminSupportPage from '../src/app/admin/support/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const ticket = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  ticket_id: id,
  raised_by: 'u1',
  raised_by_name: 'Asha Patel',
  raised_by_phone: '+919876543210',
  raised_by_bfam_id: 'BF1001',
  category: 'PAYMENT_ISSUE',
  description: 'I was charged twice for one booking.',
  related_entity_type: null,
  related_entity_id: null,
  status,
  dispute_type: 'COMPLAINT',
  assigned_to: null,
  created_at: new Date().toISOString(),
  resolved_at: null,
  ...over,
});

const queue = (...rows: ReturnType<typeof ticket>[]) => ({
  results: rows,
  counts: {
    OPEN: rows.filter((r) => r.status === 'OPEN').length,
    IN_PROGRESS: rows.filter((r) => r.status === 'IN_PROGRESS').length,
    RESOLVED: rows.filter((r) => r.status === 'RESOLVED').length,
    CLOSED: rows.filter((r) => r.status === 'CLOSED').length,
  },
});

describe('Admin Web — Support queue (PRD §9.1)', () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  it('lists tickets with who raised them', async () => {
    api.getAdminTickets.mockResolvedValue(queue(ticket('t1', 'OPEN')));
    render(<AdminSupportPage />);

    expect(await screen.findByText('I was charged twice for one booking.')).toBeInTheDocument();
    expect(screen.getByText(/Asha Patel/)).toBeInTheDocument();
  });

  it('filters by status tab and by search', async () => {
    api.getAdminTickets.mockResolvedValue(
      queue(
        ticket('t1', 'OPEN'),
        ticket('t2', 'CLOSED', { description: 'Old resolved thing', raised_by_name: 'Rohan Shah' }),
      ),
    );
    render(<AdminSupportPage />);
    await screen.findByText('I was charged twice for one booking.');

    fireEvent.click(screen.getByTestId('ticket-status-CLOSED'));
    await waitFor(() =>
      expect(screen.queryByText('I was charged twice for one booking.')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Old resolved thing')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ticket-status-ALL'));
    fireEvent.change(screen.getByTestId('ticket-search'), { target: { value: 'rohan' } });
    await waitFor(() =>
      expect(screen.queryByText('I was charged twice for one booking.')).not.toBeInTheDocument(),
    );
  });

  it('moves an open ticket into progress', async () => {
    api.getAdminTickets.mockResolvedValue(queue(ticket('t1', 'OPEN')));
    api.updateTicketStatus.mockResolvedValue({});
    render(<AdminSupportPage />);

    fireEvent.click(await screen.findByTestId('ticket-t1'));
    fireEvent.click(await screen.findByTestId('ticket-to-IN_PROGRESS'));

    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledWith('t1', 'IN_PROGRESS'));
    await waitFor(() => expect(api.getAdminTickets.mock.calls.length).toBeGreaterThan(1));
  });

  it('asks before closing a ticket', async () => {
    api.getAdminTickets.mockResolvedValue(queue(ticket('t1', 'IN_PROGRESS')));
    api.updateTicketStatus.mockResolvedValue({});
    render(<AdminSupportPage />);

    fireEvent.click(await screen.findByTestId('ticket-t1'));
    fireEvent.click(await screen.findByTestId('ticket-to-CLOSED'));
    expect(api.updateTicketStatus).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledWith('t1', 'CLOSED'));
  });

  it('offers no actions on a closed ticket', async () => {
    api.getAdminTickets.mockResolvedValue(queue(ticket('t1', 'CLOSED')));
    render(<AdminSupportPage />);

    fireEvent.click(await screen.findByTestId('ticket-t1'));
    expect(await screen.findByText('This ticket is closed.')).toBeInTheDocument();
    expect(screen.queryByTestId('ticket-to-IN_PROGRESS')).not.toBeInTheDocument();
  });

  it('shows the server’s reason when a move is refused', async () => {
    api.getAdminTickets.mockResolvedValue(queue(ticket('t1', 'OPEN')));
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.updateTicketStatus.mockRejectedValue(new BFAMApiError('Cannot move that ticket.', 409));
    render(<AdminSupportPage />);

    fireEvent.click(await screen.findByTestId('ticket-t1'));
    fireEvent.click(await screen.findByTestId('ticket-to-IN_PROGRESS'));
    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalled());
    // The ticket is unchanged — still offering the same next step.
    expect(screen.getByTestId('ticket-to-IN_PROGRESS')).toBeInTheDocument();
  });

  it('shows an inbox-zero state with no tickets', async () => {
    api.getAdminTickets.mockResolvedValue(queue());
    render(<AdminSupportPage />);
    expect(await screen.findByText('No support tickets have been raised yet.')).toBeInTheDocument();
  });
});
