import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  apiClient: {
    getStaffTodaysBookings: jest.fn(),
    getStaffMatches: jest.fn(),
    getMyStaffAssignments: jest.fn(),
    getBookingDetails: jest.fn(),
    getBookingMatches: jest.fn(),
    getObligations: jest.fn(),
    getBookingPayments: jest.fn(),
    getGameRoom: jest.fn(),
    setPlayerAttendance: jest.fn(),
    recordCashPayment: jest.fn(),
  },
}));

import { apiClient } from '../src/lib/apiClient';
import StaffBookingsPage from '../src/app/staff/page';

const api = apiClient as unknown as Record<string, jest.Mock>;

const BOOKING = {
  booking_id: 'b1',
  turf_id: 't1',
  booked_by: 'u1',
  booking_date: '2099-01-01',
  turf_name: 'Redline Turf Arena',
  start_time: '23:00:00',
  end_time: '23:59:00',
  duration_minutes: 59,
  booking_amount: 1200,
  booking_status: 'CONFIRMED',
  payment_mode: 'UPI',
  created_at: '',
  updated_at: '',
};

const PLAYERS = [
  {
    match_player_id: 'mp1',
    match_id: 'm1',
    player_id: 'p1',
    match_team_id: null,
    participant_role: 'PLAYER',
    invitation_status: 'CONFIRMED',
    attendance_status: 'PENDING',
    checked_in_at: null,
    added_at: '',
    bfam_id: 'BF1001',
    full_name: 'Asha Patel',
  },
];

function stubDesk({ verified = true }: { verified?: boolean } = {}) {
  api.getStaffTodaysBookings.mockResolvedValue({ results: [BOOKING] });
  api.getStaffMatches.mockResolvedValue({ results: [] });
  api.getMyStaffAssignments.mockResolvedValue({
    results: [
      {
        assignment_id: 'a1',
        turf_id: 't1',
        staff_user_id: 's1',
        status: 'ACTIVE',
        verification_status: verified ? 'APPROVED' : 'PENDING',
      },
    ],
  });
  api.getBookingMatches.mockResolvedValue({
    booking_id: 'b1',
    matches: [
      { match_id: 'm1', match_name: 'Sunday Smash', scheduled_start_time: '2099-01-01T23:00:00Z' },
    ],
  });
  api.getGameRoom.mockResolvedValue({ players: PLAYERS });
  api.getObligations.mockResolvedValue({
    results: [
      {
        obligation_id: 'o1',
        booking_id: 'b1',
        player_id: null,
        amount_due: 600,
        due_status: 'PENDING',
      },
    ],
  });
  api.getBookingPayments.mockResolvedValue({ results: [] });
  api.setPlayerAttendance.mockResolvedValue(undefined);
  api.recordCashPayment.mockResolvedValue({ payment_id: 'pay1' });
}

describe('Staff Web — Today’s Desk (module 2.12, PRD §9.3)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it('lists today’s bookings with time and status', async () => {
    stubDesk();
    render(<StaffBookingsPage />);

    expect(await screen.findByText('Redline Turf Arena')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getAllByText(/23:00/).length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no bookings today', async () => {
    stubDesk();
    api.getStaffTodaysBookings.mockResolvedValue({ results: [] });
    render(<StaffBookingsPage />);

    expect(
      await screen.findByText('No bookings today at your assigned turf(s).'),
    ).toBeInTheDocument();
  });

  it('warns unverified staff and links to verification', async () => {
    stubDesk({ verified: false });
    render(<StaffBookingsPage />);

    expect(await screen.findByTestId('verification-banner')).toHaveAttribute(
      'href',
      '/staff/verification',
    );
  });

  it('opens a booking’s desk and checks a player in', async () => {
    stubDesk();
    render(<StaffBookingsPage />);

    fireEvent.click(await screen.findByTestId('open-desk-b1'));
    expect(await screen.findByText('Asha Patel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('checkin-p1'));
    await waitFor(() =>
      expect(api.setPlayerAttendance).toHaveBeenCalledWith('m1', 'p1', 'CHECKED_IN'),
    );
  });

  it('marks a player as a no-show', async () => {
    stubDesk();
    render(<StaffBookingsPage />);

    fireEvent.click(await screen.findByTestId('open-desk-b1'));
    fireEvent.click(await screen.findByTestId('noshow-p1'));

    await waitFor(() =>
      expect(api.setPlayerAttendance).toHaveBeenCalledWith('m1', 'p1', 'NO_SHOW'),
    );
  });

  it('rolls the attendance change back when the server refuses it', async () => {
    stubDesk();
    const { BFAMApiError } = jest.requireActual('@bfam/api-client');
    api.setPlayerAttendance.mockRejectedValue(
      new BFAMApiError('Your ID has not been verified yet.', 403),
    );
    render(<StaffBookingsPage />);

    fireEvent.click(await screen.findByTestId('open-desk-b1'));
    fireEvent.click(await screen.findByTestId('checkin-p1'));

    await waitFor(() => expect(api.setPlayerAttendance).toHaveBeenCalled());
    // Back to awaiting, not left showing "Checked in".
    expect(await screen.findByText('Awaiting')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-p1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('collects cash for the selected pending obligations', async () => {
    stubDesk();
    render(<StaffBookingsPage />);

    fireEvent.click(await screen.findByTestId('open-desk-b1'));
    fireEvent.click(await screen.findByTestId('desk-tab-payments'));
    fireEvent.click(await screen.findByTestId('obligation-o1'));
    fireEvent.change(screen.getByTestId('cash-reference'), { target: { value: 'R-77' } });
    fireEvent.click(screen.getByTestId('collect-cash'));

    await waitFor(() => expect(api.recordCashPayment).toHaveBeenCalledWith(['o1'], 'R-77'));
  });

  it('looks a booking up by ID', async () => {
    stubDesk();
    api.getBookingDetails.mockResolvedValue({ ...BOOKING, booking_id: 'zzz-999' });
    render(<StaffBookingsPage />);

    await screen.findByText('Redline Turf Arena');
    const input = screen.getByTestId('booking-lookup');
    fireEvent.change(input, { target: { value: 'zzz-999' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(api.getBookingDetails).toHaveBeenCalledWith('zzz-999'));
    expect(await screen.findByTestId('booking-drawer')).toBeInTheDocument();
  });
});
