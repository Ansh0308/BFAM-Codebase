import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getMyMatches: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react');
    ReactForMock.useEffect(callback, [callback]);
  },
}));

const mockGetMyMatches = apiClient.getMyMatches as jest.Mock;

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
