import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { istHHMM, slotState } from '../src/lib/slotTime';

// A booked slot holds several matches, played one after another (tester sheet row 14).
// Nobody can say in advance when a match ends, so there is no time to pick: a new match
// can be created while the slot has not ended and the earlier ones are finished.

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: { bookingId?: string } = { bookingId: 'booking-1' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    canGoBack: () => true,
    back: jest.fn(),
  }),
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
const mockGetBookingDetails = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    createMatch: (...a: unknown[]) => mockCreateMatch(...a),
    getBookingMatches: (...a: unknown[]) => mockGetBookingMatches(...a),
    getBookingDetails: (...a: unknown[]) => mockGetBookingDetails(...a),
    getMyTeams: jest.fn().mockResolvedValue({ results: [] }),
    searchTeams: jest.fn().mockResolvedValue({ results: [] }),
  },
}));

import CreateMatchScreen from '../app/(tabs)/matches/create';
import SlotScreen from '../app/(tabs)/matches/slot/[bookingId]';
import { SlotMatches, matchTimingText } from '../src/components/SlotMatches';
import { SlotCard } from '../src/components/matches/SlotCard';

// 6:05 PM - 6:40 PM India time = 12:35 - 13:10 UTC
const PLAYED = {
  match_id: 'm1',
  match_name: 'Warm-up',
  match_type: 'FRIENDS',
  match_status: 'COMPLETED',
  scheduled_start_time: '2026-12-20T12:30:00.000Z',
  actual_start_time: '2026-12-20T12:35:00.000Z',
  actual_end_time: '2026-12-20T13:10:00.000Z',
  overs_per_innings: 5,
};
const LIVE = {
  ...PLAYED,
  match_id: 'm2',
  match_name: 'Decider',
  match_status: 'IN_PROGRESS',
  actual_end_time: null,
};
const SLOT = (over: Record<string, unknown> = {}) => ({
  booking_id: 'booking-1',
  booking_date: '2026-12-20',
  slot_start_time: '18:00:00',
  slot_end_time: '20:00:00',
  slot_state: 'ACTIVE',
  can_add_match: true,
  reason: null,
  matches: [PLAYED],
  ...over,
});

describe('slot helpers', () => {
  it('shows instants in India time', () => {
    expect(istHHMM('2026-12-20T12:30:00.000Z')).toBe('18:00');
  });

  it('knows whether a slot is upcoming, on now, or ended', () => {
    const slot = { booking_date: '2026-12-20', start_time: '18:00:00', end_time: '20:00:00' };
    const at = (hhmm: string) => new Date(`2026-12-20T${hhmm}:00+05:30`);
    expect(slotState(slot, at('17:00'))).toBe('UPCOMING');
    expect(slotState(slot, at('18:00'))).toBe('ACTIVE');
    expect(slotState(slot, at('19:59'))).toBe('ACTIVE');
    expect(slotState(slot, at('20:00'))).toBe('PASSED');
  });

  it('describes what a match really took, not a planned time', () => {
    expect(matchTimingText(PLAYED as never)).toBe('Played 6:05 PM – 6:40 PM');
    expect(matchTimingText(LIVE as never)).toBe('Started 6:05 PM · in progress');
    expect(
      matchTimingText({ match_status: 'OPEN', actual_start_time: null, actual_end_time: null }),
    ).toBe('Not started yet');
    expect(
      matchTimingText({
        match_status: 'CANCELLED',
        actual_start_time: null,
        actual_end_time: null,
      }),
    ).toBe('Cancelled');
  });
});

describe('Create Match inside a slot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { bookingId: 'booking-1' };
    mockCreateMatch.mockResolvedValue({ match_id: 'new-match' });
  });

  it('has no start or end time to choose, and sends none', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT());
    const { getByTestId, findByTestId, queryByTestId } = await render(<CreateMatchScreen />);
    expect(await findByTestId('match-slot-time')).toBeTruthy();
    expect(queryByTestId('match-start-time-trigger')).toBeNull();

    await fireEvent.press(getByTestId('submit-create-match'));
    await waitFor(() => expect(mockCreateMatch).toHaveBeenCalled());
    const sent = mockCreateMatch.mock.calls[0][0];
    expect(sent.booking_id).toBe('booking-1');
    expect(sent).not.toHaveProperty('start_time');
    expect(sent).not.toHaveProperty('end_time');
  });

  it('explains and does not submit while an earlier match in the slot is still running', async () => {
    mockGetBookingMatches.mockResolvedValue(
      SLOT({
        can_add_match: false,
        reason: 'Finish the current match in this slot before creating the next one.',
        matches: [LIVE],
      }),
    );
    const { getByTestId, findByText } = await render(<CreateMatchScreen />);
    expect(await findByText(/Finish the current match/)).toBeTruthy();

    await fireEvent.press(getByTestId('submit-create-match'));
    expect(mockCreateMatch).not.toHaveBeenCalled();
  });

  it('refuses a slot that has already ended', async () => {
    mockGetBookingMatches.mockResolvedValue(
      SLOT({
        slot_state: 'PASSED',
        can_add_match: false,
        reason: 'This slot has ended. Book a new slot to play more matches.',
      }),
    );
    const { getByTestId, findAllByText } = await render(<CreateMatchScreen />);
    expect((await findAllByText(/slot has ended/)).length).toBeGreaterThan(0);

    await fireEvent.press(getByTestId('submit-create-match'));
    expect(mockCreateMatch).not.toHaveBeenCalled();
  });
});

describe('SlotMatches', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists matches with when they really started and finished, and offers the next one', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT());
    const { findByTestId, getByTestId, getByText } = await render(
      <SlotMatches bookingId="booking-1" />,
    );
    expect(await findByTestId('slot-match-m1')).toBeTruthy();
    expect(getByText(/Played 6:05 PM – 6:40 PM · 5 overs/)).toBeTruthy();

    await fireEvent.press(getByTestId('add-match-in-slot'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/create?bookingId=booking-1');
  });

  it('shows why there is no create button while a match is running', async () => {
    mockGetBookingMatches.mockResolvedValue(
      SLOT({
        can_add_match: false,
        reason: 'Finish the current match in this slot before creating the next one.',
        matches: [PLAYED, LIVE],
      }),
    );
    const { findByTestId, queryByTestId } = await render(<SlotMatches bookingId="booking-1" />);
    expect(await findByTestId('slot-blocked-reason')).toBeTruthy();
    expect(queryByTestId('add-match-in-slot')).toBeNull();
  });

  it('on a passed slot lists what was played and offers no create button', async () => {
    mockGetBookingMatches.mockResolvedValue(
      SLOT({
        slot_state: 'PASSED',
        can_add_match: false,
        reason: 'This slot has ended. Book a new slot to play more matches.',
      }),
    );
    const { findByTestId, queryByTestId } = await render(<SlotMatches bookingId="booking-1" />);
    expect(await findByTestId('slot-match-m1')).toBeTruthy();
    expect(queryByTestId('add-match-in-slot')).toBeNull();
  });

  it('opens a listed match', async () => {
    mockGetBookingMatches.mockResolvedValue(SLOT());
    const { findByTestId } = await render(<SlotMatches bookingId="booking-1" />);
    await fireEvent.press(await findByTestId('slot-match-m1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/m1');
  });
});

describe('Slot screen and card', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the slot screen shows the slot and its matches', async () => {
    mockGetBookingDetails.mockResolvedValue({
      booking_id: 'booking-1',
      booking_date: '2020-01-01',
      start_time: '18:00:00',
      end_time: '20:00:00',
      turf_name: 'Green Park',
    });
    mockGetBookingMatches.mockResolvedValue(
      SLOT({ slot_state: 'PASSED', can_add_match: false, reason: 'This slot has ended.' }),
    );
    const { findByTestId, getByTestId } = await render(<SlotScreen />);
    expect(await findByTestId('slot-screen')).toBeTruthy();
    expect(getByTestId('slot-when').props.children.join('')).toContain('6:00 PM');
    expect(await findByTestId('slot-match-m1')).toBeTruthy();
  });

  it('a slot card opens its slot', async () => {
    const onPress = jest.fn();
    const booking = {
      booking_id: 'booking-1',
      booking_date: '2020-01-01',
      start_time: '18:00:00',
      end_time: '20:00:00',
      turf_name: 'Green Park',
    };
    const { getByTestId, getByText } = await render(
      <SlotCard booking={booking as never} onPress={onPress} />,
    );
    expect(getByText('Green Park')).toBeTruthy();
    expect(getByText('Ended')).toBeTruthy();
    await fireEvent.press(getByTestId('slot-card-booking-1'));
    expect(onPress).toHaveBeenCalled();
  });
});
