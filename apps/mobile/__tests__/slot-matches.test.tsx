import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { freeWindows, istHHMM } from '../src/lib/slotTime';

// A booked slot can hold several matches (tester sheet row 14): the create screen
// places a match in the free part of the slot, and the booking screen lists them.

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookingId: 'booking-1' }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const R = require('react');
    R.useEffect(cb, []);
  },
}));
jest.mock('../src/store/rebookStore', () => ({
  useRebookStore: (selector: (s: { plan: null; clear: () => void }) => unknown) =>
    selector({ plan: null, clear: jest.fn() }),
}));
jest.mock('../src/store/challengeMatchStore', () => ({
  useChallengeMatchStore: (selector: (s: { plan: null; clear: () => void }) => unknown) =>
    selector({ plan: null, clear: jest.fn() }),
}));

const mockCreateMatch = jest.fn();
const mockGetBookingMatches = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    createMatch: (...a: unknown[]) => mockCreateMatch(...a),
    getBookingMatches: (...a: unknown[]) => mockGetBookingMatches(...a),
    getMyTeams: jest.fn().mockResolvedValue({ results: [] }),
    searchTeams: jest.fn().mockResolvedValue({ results: [] }),
  },
}));

import CreateMatchScreen from '../app/(tabs)/matches/create';
import { SlotMatches } from '../src/components/SlotMatches';

// 18:00-18:45 India time = 12:30-13:15 UTC
const FIRST = {
  match_id: 'm1',
  match_name: 'Warm-up',
  match_type: 'FRIENDS',
  match_status: 'COMPLETED',
  scheduled_start_time: '2026-12-20T12:30:00.000Z',
  scheduled_end_time: '2026-12-20T13:15:00.000Z',
  overs_per_innings: 5,
};
const FILLS_SLOT = { ...FIRST, scheduled_end_time: '2026-12-20T14:30:00.000Z' };
const SLOT = (matches: unknown[]) => ({
  booking_id: 'booking-1',
  booking_date: '2026-12-20',
  slot_start_time: '18:00:00',
  slot_end_time: '20:00:00',
  matches,
});

describe('slot time helpers', () => {
  it('shows match instants in India time', () => {
    expect(istHHMM('2026-12-20T12:30:00.000Z')).toBe('18:00');
  });

  it('finds the free stretches of a slot, ignoring cancelled matches', () => {
    expect(freeWindows('18:00:00', '20:00:00', [])).toEqual([{ from: '18:00', to: '20:00' }]);
    expect(freeWindows('18:00:00', '20:00:00', [FIRST])).toEqual([{ from: '18:45', to: '20:00' }]);
    expect(freeWindows('18:00:00', '20:00:00', [{ ...FIRST, match_status: 'CANCELLED' }])).toEqual([
      { from: '18:00', to: '20:00' },
    ]);
    // a match from before slots could be split (no end) fills the slot
    expect(freeWindows('18:00:00', '20:00:00', [{ ...FIRST, scheduled_end_time: null }])).toEqual(
      [],
    );
  });
});

describe('Create Match inside a slot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateMatch.mockResolvedValue({ match_id: 'new-match' });
  });

  it('defaults a second match to the free time after the first and sends its window', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT([FIRST]));
    const { getByTestId, findByTestId } = await render(<CreateMatchScreen />);
    expect(await findByTestId('match-slot-time')).toBeTruthy();

    await fireEvent.press(getByTestId('submit-create-match'));
    await waitFor(() =>
      expect(mockCreateMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-1',
          start_time: '18:45',
          end_time: '20:00',
        }),
      ),
    );
  });

  it('lets the organizer choose a different part of the slot', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT([]));
    const { getByTestId, findByTestId } = await render(<CreateMatchScreen />);
    await findByTestId('match-slot-time');

    await fireEvent.press(getByTestId('match-end-time-trigger'));
    await fireEvent.press(getByTestId('match-end-time-hour-option-19'));
    await fireEvent.press(getByTestId('match-end-time-minute-option-00'));
    await fireEvent.press(getByTestId('match-end-time-done'));

    await fireEvent.press(getByTestId('submit-create-match'));
    await waitFor(() =>
      expect(mockCreateMatch).toHaveBeenCalledWith(
        expect.objectContaining({ start_time: '18:00', end_time: '19:00' }),
      ),
    );
  });

  it('says so, and does not submit, when the slot is already full', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT([FILLS_SLOT]));
    const { getByTestId, findByText } = await render(<CreateMatchScreen />);
    await waitFor(() => expect(mockGetBookingMatches).toHaveBeenCalled());

    await fireEvent.press(getByTestId('submit-create-match'));
    expect(await findByText(/already full of matches/)).toBeTruthy();
    expect(mockCreateMatch).not.toHaveBeenCalled();
  });
});

describe('SlotMatches on the booking screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the slot matches with their times, the free time, and an add button', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT([FIRST]));
    const { findByTestId, getByTestId, getByText } = await render(
      <SlotMatches bookingId="booking-1" canAddMatch />,
    );
    expect(await findByTestId('slot-match-m1')).toBeTruthy();
    expect(getByText(/6:00 PM – 6:45 PM · 5 overs/)).toBeTruthy();
    expect(getByTestId('slot-free-time').props.children).toContain('6:45 PM – 8:00 PM');

    await fireEvent.press(getByTestId('add-match-in-slot'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/create?bookingId=booking-1');
  });

  it('hides the add button when the slot is full', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT([FILLS_SLOT]));
    const { findByTestId, queryByTestId } = await render(
      <SlotMatches bookingId="booking-1" canAddMatch />,
    );
    expect(await findByTestId('slot-match-m1')).toBeTruthy();
    expect(queryByTestId('add-match-in-slot')).toBeNull();
  });

  it('opens a listed match', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT([FIRST]));
    const { findByTestId } = await render(<SlotMatches bookingId="booking-1" canAddMatch />);
    await fireEvent.press(await findByTestId('slot-match-m1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/m1');
  });
});
