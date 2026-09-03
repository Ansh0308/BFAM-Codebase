import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getStaffTodaysBookings: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGetBookings = apiClient.getStaffTodaysBookings as jest.Mock;

import { StaffDashboard } from '../src/screens/StaffDashboard';

describe('StaffDashboard (module 2.12, PRD §8.4)', () => {
  beforeEach(() => {
    mockGetBookings.mockReset();
    mockPush.mockReset();
  });

  it('loads and lists today’s bookings at the staff member’s assigned turf(s)', async () => {
    mockGetBookings.mockResolvedValueOnce({
      results: [
        {
          booking_id: 'b1',
          turf_name: 'Redline Turf Arena',
          start_time: '18:00:00',
          booking_status: 'CONFIRMED',
        },
      ],
    });

    const { findByText } = render(<StaffDashboard />);
    expect(await findByText('Redline Turf Arena')).toBeTruthy();
  });

  it('shows an empty state when there are no bookings today', async () => {
    mockGetBookings.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = render(<StaffDashboard />);
    expect(await findByTestId('staff-bookings-empty')).toBeTruthy();
  });

  it('the verification banner and Match Operations link both navigate correctly', async () => {
    mockGetBookings.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = render(<StaffDashboard />);
    await waitFor(() => expect(mockGetBookings).toHaveBeenCalled());

    fireEvent.press(await findByTestId('verification-status-banner'));
    expect(mockPush).toHaveBeenCalledWith('/staff-verification');

    fireEvent.press(await findByTestId('quick-link-matches'));
    expect(mockPush).toHaveBeenCalledWith('/staff-matches');
  });
});
