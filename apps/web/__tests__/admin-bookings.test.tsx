import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getAdminBookings: jest.fn(),
    setAdminBookingStatus: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import AdminBookingsPage from '../src/app/admin/bookings/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const row = (over: Record<string, unknown> = {}) => ({
  booking_id: 'b1',
  turf_id: 't1',
  turf_name: 'Green Park',
  booking_date: '2026-10-05',
  start_time: '18:00:00',
  end_time: '19:00:00',
  status: 'CONFIRMED',
  customer_name: 'Asha',
  customer_phone: '+919900000001',
  owner_phone: '+919900000002',
  amount_due: '1200',
  amount_paid: '500',
  ...over,
});

describe('Admin Bookings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists bookings across turfs with money and status', async () => {
    api.getAdminBookings.mockResolvedValue({ results: [row()] });
    render(<AdminBookingsPage />);
    expect(await screen.findByText('Green Park')).toBeInTheDocument();
    expect(screen.getByText(/Asha/)).toBeInTheDocument();
    expect(screen.getByText('₹1,200')).toBeInTheDocument();
    expect(screen.getByText('18:00–19:00')).toBeInTheDocument();
  });

  it('sends the chosen date range', async () => {
    api.getAdminBookings.mockResolvedValue({ results: [] });
    render(<AdminBookingsPage />);
    await screen.findByTestId('bookings-empty');
    expect(api.getAdminBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('corrects a booking’s status', async () => {
    api.getAdminBookings.mockResolvedValue({ results: [row()] });
    api.setAdminBookingStatus.mockResolvedValue({});
    render(<AdminBookingsPage />);
    const select = await screen.findByTestId('status-b1');
    fireEvent.change(select, { target: { value: 'COMPLETED' } });
    await waitFor(() => expect(api.setAdminBookingStatus).toHaveBeenCalledWith('b1', 'COMPLETED'));
  });

  it('does not offer a status change on cancelled bookings', async () => {
    api.getAdminBookings.mockResolvedValue({ results: [row({ status: 'CANCELLED' })] });
    render(<AdminBookingsPage />);
    await screen.findByText('Green Park');
    expect(screen.queryByTestId('status-b1')).toBeNull();
  });

  it('shows the server’s message when the range is refused', async () => {
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.getAdminBookings.mockRejectedValue(
      new BFAMApiError('Choose a date range of at most 92 days.', 400),
    );
    render(<AdminBookingsPage />);
    expect(await screen.findByTestId('bookings-error')).toHaveTextContent(/92 days/);
  });
});
