import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getStaffTodaysBookings: jest.fn() },
}));

import { apiClient } from '../src/lib/apiClient';
import StaffBookingsPage from '../src/app/staff/page';

const mockGetStaffTodaysBookings = apiClient.getStaffTodaysBookings as jest.Mock;

describe('Staff Web Dashboard (module 2.12, PRD §9.3)', () => {
  beforeEach(() => {
    mockGetStaffTodaysBookings.mockReset();
  });

  it('loads and lists today’s bookings at the staff member’s assigned turf(s)', async () => {
    mockGetStaffTodaysBookings.mockResolvedValueOnce({
      results: [
        {
          booking_id: 'b1',
          turf_name: 'Redline Turf Arena',
          start_time: '18:00:00',
          end_time: '19:00:00',
          booking_status: 'CONFIRMED',
        },
      ],
    });

    render(<StaffBookingsPage />);

    expect(await screen.findByText('Redline Turf Arena')).toBeInTheDocument();
    expect(screen.getByText('18:00–19:00')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('shows an empty state when there are no bookings today', async () => {
    mockGetStaffTodaysBookings.mockResolvedValueOnce({ results: [] });
    render(<StaffBookingsPage />);

    await waitFor(() => expect(mockGetStaffTodaysBookings).toHaveBeenCalled());
    expect(
      await screen.findByText('No bookings today at your assigned turf(s).'),
    ).toBeInTheDocument();
  });
});
