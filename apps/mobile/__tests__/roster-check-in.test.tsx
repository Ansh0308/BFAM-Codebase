import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';
import { BFAMApiError } from '@bfam/api-client';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getGameRoom: jest.fn(), setPlayerAttendance: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

const mockGetGameRoom = apiClient.getGameRoom as jest.Mock;
const mockSetAttendance = apiClient.setPlayerAttendance as jest.Mock;

import RosterCheckInScreen from '../app/(tabs)/matches/[matchId]/roster-check-in';

const ROOM = {
  match_id: 'm1',
  organizer_id: 'org1',
  assigned_scorer_id: null,
  players: [
    {
      player_id: 'p1',
      bfam_id: 'BF1001',
      invitation_status: 'CONFIRMED',
      attendance_status: 'PENDING',
    },
    {
      player_id: 'p2',
      bfam_id: 'BF1002',
      invitation_status: 'CONFIRMED',
      attendance_status: 'CHECKED_IN',
    },
  ],
};

describe('Player Check-In (module 2.12, PRD §8.3/§8.4 "Check-In")', () => {
  beforeEach(() => {
    mockGetGameRoom.mockReset();
    mockSetAttendance.mockReset();
  });

  it('lists confirmed players with their current attendance state', async () => {
    mockGetGameRoom.mockResolvedValueOnce(ROOM);
    const { findByText, getByTestId } = render(<RosterCheckInScreen />);

    expect(await findByText('BF1001')).toBeTruthy();
    expect(getByTestId('checked-in-p2')).toBeTruthy();
  });

  it('checks a pending player in on tap', async () => {
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockSetAttendance.mockResolvedValueOnce(undefined);

    const { findByTestId } = render(<RosterCheckInScreen />);
    fireEvent.press(await findByTestId('check-in-button-p1'));

    await waitFor(() => expect(mockSetAttendance).toHaveBeenCalledWith('m1', 'p1', 'CHECKED_IN'));
  });

  it('surfaces the staff-verification-gate error (PRD §32.14) instead of silently failing', async () => {
    mockGetGameRoom.mockResolvedValue(ROOM);
    mockSetAttendance.mockRejectedValueOnce(
      new BFAMApiError('Your staff account is still pending verification by the turf owner.', 403),
    );

    const { findByTestId, findByText } = render(<RosterCheckInScreen />);
    fireEvent.press(await findByTestId('check-in-button-p1'));

    expect(await findByText(/pending verification/i)).toBeTruthy();
  });
});
