import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getViewerCount: jest.fn() },
}));

const mockOn = jest.fn();
const mockOff = jest.fn();
const mockEmit = jest.fn();
jest.mock('../src/lib/socket', () => ({
  getSocket: () => ({ on: mockOn, off: mockOff, emit: mockEmit }),
  joinMatchRoom: jest.fn(),
  leaveMatchRoom: jest.fn(),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { user_id: string } | null }) => unknown) =>
    selector({ user: { user_id: 'user-1' } }),
}));

const mockGetViewerCount = apiClient.getViewerCount as jest.Mock;

import { ViewerCountBadge } from '../src/components/ViewerCountBadge';

// Backlog A-23: "Remove the 'Watching Live' count and keep only the total
// views count." The active-presence tracking underneath (join/leave/
// heartbeat, Redis presence set) stays running — only the display changes.
describe('ViewerCountBadge (backlog A-23)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows only the total views count, not the active/"Watching Live" count', async () => {
    mockGetViewerCount.mockResolvedValue({ active: 4, total: 128 });

    const { findByTestId, queryByTestId, queryByText } = await render(
      <ViewerCountBadge matchId="match-1" />,
    );

    await findByTestId('viewer-count-total');
    expect(queryByText(/Watching Live/)).toBeNull();
    expect(queryByTestId('viewer-count-active')).toBeNull();
  });

  it('renders the badge once the total views count has loaded', async () => {
    mockGetViewerCount.mockResolvedValue({ active: 0, total: 5 });

    const { findByTestId } = await render(<ViewerCountBadge matchId="match-1" />);

    await findByTestId('viewer-count-badge');
  });

  it('still joins the match room and starts the presence heartbeat', async () => {
    mockGetViewerCount.mockResolvedValue({ active: 1, total: 1 });

    await render(<ViewerCountBadge matchId="match-1" />);

    await waitFor(() =>
      expect(mockEmit).toHaveBeenCalledWith('join_match_viewer', {
        matchId: 'match-1',
        userId: 'user-1',
      }),
    );
  });
});
