import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyMatches: jest.fn(),
    getMyProfile: jest.fn(),
    getNotifications: jest.fn(),
    getLiveScore: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
}));

const mockPush = jest.fn();
const mockGetMyMatches = apiClient.getMyMatches as jest.Mock;
const mockGetMyProfile = apiClient.getMyProfile as jest.Mock;
const mockGetNotifications = apiClient.getNotifications as jest.Mock;
const mockGetLiveScore = apiClient.getLiveScore as jest.Mock;

import MyMatchesScreen from '../app/(tabs)/matches/index';

const UPCOMING_MATCH = {
  match_id: 'm-upcoming',
  match_name: 'Sunday Bash',
  match_type: 'FRIENDS',
  match_status: 'CONFIRMED',
  scheduled_start_time: '2026-12-01T18:00:00.000Z',
};
const PAST_MATCH = {
  match_id: 'm-past',
  match_name: 'Old Match',
  match_type: 'FRIENDS',
  match_status: 'COMPLETED',
  scheduled_start_time: '2025-01-01T18:00:00.000Z',
};

// Backlog A-15: split My Matches into Upcoming/Past tabs instead of one
// long, undifferentiated list.
describe('My Matches — Upcoming/Past tabs (backlog A-15)', () => {
  beforeEach(() => {
    mockGetMyMatches.mockReset();
    mockGetMyProfile.mockResolvedValue({ coin_balance: 0 });
    mockGetNotifications.mockResolvedValue({ results: [] });
  });

  it('loads the Upcoming scope by default', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [UPCOMING_MATCH] });
    const { findByText } = await render(<MyMatchesScreen />);

    await findByText('Sunday Bash');
    expect(mockGetMyMatches).toHaveBeenCalledWith('upcoming');
  });

  it('switches to Past and refetches with the past scope', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [UPCOMING_MATCH] });
    const { findByTestId, findByText } = await render(<MyMatchesScreen />);
    await findByText('Sunday Bash');

    mockGetMyMatches.mockResolvedValueOnce({ results: [PAST_MATCH] });
    await fireEvent.press(await findByTestId('my-matches-scope-past'));

    await waitFor(() => expect(mockGetMyMatches).toHaveBeenCalledWith('past'));
    await findByText('Old Match');
  });

  it('hides the "Book a Turf" empty-state CTA on the Past tab', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [UPCOMING_MATCH] });
    const { findByTestId, findByText, queryByTestId } = await render(<MyMatchesScreen />);
    await findByText('Sunday Bash');

    mockGetMyMatches.mockResolvedValueOnce({ results: [] });
    await fireEvent.press(await findByTestId('my-matches-scope-past'));

    await findByText('No past matches yet.');
    expect(queryByTestId('my-matches-empty-book-turf')).toBeNull();
  });
});

// Presentation redesign: venue line, status treatments, live card, header.
describe('My Matches — redesigned cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyMatches.mockReset();
    mockGetMyProfile.mockResolvedValue({ coin_balance: 12 });
    mockGetNotifications.mockResolvedValue({ results: [{ read_at: null }] });
  });

  it('shows the venue (turf, city) and a count of matches', async () => {
    mockGetMyMatches.mockResolvedValueOnce({
      results: [{ ...UPCOMING_MATCH, turf_name: 'Skyline Turf', city: 'Rajkot' }],
    });
    const { findByText } = await render(<MyMatchesScreen />);

    await findByText('Skyline Turf, Rajkot');
    await findByText('1 Match');
  });

  it('omits the venue line when the turf could not be resolved', async () => {
    mockGetMyMatches.mockResolvedValueOnce({
      results: [{ ...UPCOMING_MATCH, turf_name: null, city: null }],
    });
    const { findByText, queryByText } = await render(<MyMatchesScreen />);

    await findByText('Sunday Bash');
    expect(queryByText(/Rajkot/)).toBeNull();
  });

  it('keeps the real status label (Confirmed, not a generic Upcoming)', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [UPCOMING_MATCH, PAST_MATCH] });
    const { findByTestId } = await render(<MyMatchesScreen />);

    const pill = await findByTestId('match-status-m-upcoming');
    expect(within(pill).getByText('CONFIRMED')).toBeTruthy();
  });

  it('renders a live match as a live card with its score, and links to Watch Live', async () => {
    mockGetMyMatches.mockResolvedValueOnce({
      results: [
        {
          ...UPCOMING_MATCH,
          match_id: 'm-live',
          match_name: 'Warriors',
          match_status: 'IN_PROGRESS',
        },
      ],
    });
    mockGetLiveScore.mockResolvedValueOnce({
      match_id: 'm-live',
      innings: { total_runs: 86, total_wickets: 4, overs_completed: 8.2 },
    });
    const { findByText, findByTestId } = await render(<MyMatchesScreen />);

    await findByText('Warriors');
    await findByText('86 / 4');
    await findByText('8.2 OVERS');

    await fireEvent.press(await findByTestId('watch-live-m-live'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/m-live/live');
  });

  it('opens the game room when a match card is tapped', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [UPCOMING_MATCH] });
    const { findByTestId } = await render(<MyMatchesScreen />);

    await fireEvent.press(await findByTestId('my-match-row-m-upcoming'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/m-upcoming');
  });

  it('routes Find a Room to the rooms screen', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<MyMatchesScreen />);

    await fireEvent.press(await findByTestId('find-a-room-button'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/matches/rooms');
  });

  it('shows the BFAM Points balance in the header', async () => {
    mockGetMyMatches.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<MyMatchesScreen />);

    const pill = await findByTestId('home-coin-balance');
    expect(pill.props.accessibilityLabel).toBe('12 BFAM points');
  });
});
