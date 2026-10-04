import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyTurfs: jest.fn(),
    getOwnerBookings: jest.fn(),
    getObligations: jest.fn(),
    getBookingPayments: jest.fn(),
    getBookingMatches: jest.fn(),
    cancelBooking: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import OwnerBookingsPage from '../src/app/owner/bookings/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const row = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  booking_id: id,
  turf_id: 't1',
  turf_name: 'Redline Turf Arena',
  booked_by: 'u1',
  booking_date: '2099-01-01',
  start_time: '18:00:00',
  end_time: '19:00:00',
  duration_minutes: 60,
  booking_amount: 1200,
  booking_status: status,
  payment_mode: 'UPI',
  customer_name: 'Asha Patel',
  customer_phone: '+919876543210',
  amount_due: 1200,
  amount_paid: 400,
  created_at: '',
  updated_at: '',
  ...over,
});

describe('Owner Web — Bookings (PRD §30.9)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getMyTurfs.mockResolvedValue({
      results: [{ turf_id: 't1', turf_name: 'Redline Turf Arena' }],
    });
    api.getObligations.mockResolvedValue({ results: [] });
    api.getBookingPayments.mockResolvedValue({ results: [] });
    api.getBookingMatches.mockResolvedValue({ matches: [] });
  });

  it('lists bookings with customer and payment progress', async () => {
    api.getOwnerBookings.mockResolvedValue({ results: [row('b1', 'CONFIRMED')] });
    render(<OwnerBookingsPage />);

    expect(await screen.findByText('Redline Turf Arena')).toBeInTheDocument();
    expect(screen.getByText(/Asha Patel/)).toBeInTheDocument();
    expect(screen.getByText('₹400 of ₹1,200')).toBeInTheDocument();
  });

  it('asks for today by default and refetches when the window changes', async () => {
    api.getOwnerBookings.mockResolvedValue({ results: [] });
    render(<OwnerBookingsPage />);

    await waitFor(() => expect(api.getOwnerBookings).toHaveBeenCalledTimes(1));
    const first = api.getOwnerBookings.mock.calls[0][0];
    expect(first.from).toBe(first.to);

    fireEvent.click(screen.getByTestId('range-week'));
    await waitFor(() => expect(api.getOwnerBookings).toHaveBeenCalledTimes(2));
    const second = api.getOwnerBookings.mock.calls[1][0];
    expect(second.to > second.from).toBe(true);
  });

  it('filters by status and by search text', async () => {
    api.getOwnerBookings.mockResolvedValue({
      results: [
        row('b1', 'CONFIRMED'),
        row('b2', 'CANCELLED', {
          customer_name: 'Rohan Shah',
          start_time: '20:00:00',
          end_time: '21:00:00',
        }),
      ],
    });
    render(<OwnerBookingsPage />);
    await screen.findByText(/Asha Patel/);
    expect(screen.getByText(/Rohan Shah/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('status-CANCELLED'));
    await waitFor(() => expect(screen.queryByText(/Asha Patel/)).not.toBeInTheDocument());
    expect(screen.getByText(/Rohan Shah/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('status-ALL'));
    fireEvent.change(screen.getByTestId('booking-search'), { target: { value: 'asha' } });
    await waitFor(() => expect(screen.queryByText(/Rohan Shah/)).not.toBeInTheDocument());
  });

  it('shows an empty state for a window with no bookings', async () => {
    api.getOwnerBookings.mockResolvedValue({ results: [] });
    render(<OwnerBookingsPage />);
    expect(await screen.findByText('No bookings in this window.')).toBeInTheDocument();
  });

  it('opens a booking and cancels it with a reason', async () => {
    api.getOwnerBookings.mockResolvedValue({ results: [row('b1', 'CONFIRMED')] });
    api.cancelBooking.mockResolvedValue({});
    render(<OwnerBookingsPage />);

    fireEvent.click(await screen.findByTestId('booking-row-b1'));
    fireEvent.click(await screen.findByTestId('cancel-booking'));
    fireEvent.change(await screen.findByTestId('confirm-reason'), {
      target: { value: 'Pitch flooded' },
    });
    fireEvent.click(screen.getByTestId('confirm-ok'));

    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('b1', 'Pitch flooded'));
    // The list is reloaded afterwards.
    await waitFor(() => expect(api.getOwnerBookings.mock.calls.length).toBeGreaterThan(1));
  });

  it('does not offer cancellation for an already-cancelled booking', async () => {
    api.getOwnerBookings.mockResolvedValue({ results: [row('b1', 'CANCELLED')] });
    render(<OwnerBookingsPage />);

    fireEvent.click(await screen.findByTestId('booking-row-b1'));
    await screen.findByTestId('owner-booking-detail');
    expect(screen.queryByTestId('cancel-booking')).not.toBeInTheDocument();
  });
});
