import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ playerId: 'p1' }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockGetPlayerProfile = jest.fn();
const mockFollowPlayer = jest.fn();
const mockUnfollowPlayer = jest.fn();
const mockGetTurfs = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getPlayerProfile: (...args: unknown[]) => mockGetPlayerProfile(...args),
    followPlayer: (...args: unknown[]) => mockFollowPlayer(...args),
    unfollowPlayer: (...args: unknown[]) => mockUnfollowPlayer(...args),
    getTurfs: (...args: unknown[]) => mockGetTurfs(...args),
  },
}));

jest.mock('../src/config/featureFlags', () => ({ DISCOVERY_ENABLED: false }));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { bfam_id: string } }) => unknown) =>
    selector({ user: { bfam_id: 'BF9999' } }),
}));

import PlayerProfileScreen from '../app/player-profile';

const PROFILE = {
  player_id: 'p1',
  bfam_id: 'BF1001',
  full_name: 'Asha Patel',
  profile_photo_url: null,
  city: 'Rajkot',
  playing_role: 'BATTER',
  batting_style: 'RIGHT_HANDED',
  bowling_style: null,
  experience_level: 'INTERMEDIATE',
  skill_rating: 620,
  reliability_score: '95.00',
  favorite_cricketer_name: 'Virat Kohli',
  follow_summary: { followers_count: 3, following_count: 1, is_following: false },
};

// Backlog B-10: view another player's profile.
describe('Player Profile screen (backlog B-10)', () => {
  beforeEach(() => {
    mockGetPlayerProfile.mockReset();
    mockFollowPlayer.mockReset();
    mockUnfollowPlayer.mockReset();
    mockGetTurfs.mockReset();
    mockPush.mockReset();
  });

  it('loads and shows the player for the id in route params', async () => {
    mockGetPlayerProfile.mockResolvedValueOnce(PROFILE);
    const { findByText } = await render(<PlayerProfileScreen />);

    expect(await findByText('Asha Patel')).toBeTruthy();
    expect(await findByText('BF1001')).toBeTruthy();
    expect(await findByText('620')).toBeTruthy();
    expect(mockGetPlayerProfile).toHaveBeenCalledWith('p1');
  });

  it('falls back to bfam_id when the player has no full_name', async () => {
    mockGetPlayerProfile.mockResolvedValueOnce({ ...PROFILE, full_name: null });
    const { findAllByText } = await render(<PlayerProfileScreen />);

    // With no full_name, the display name AND the BFAM ID subtitle both
    // read "BF1001" — two matching nodes is the expected fallback here.
    expect(await findAllByText('BF1001')).toHaveLength(2);
  });

  it('omits a field that is null rather than showing a blank row', async () => {
    mockGetPlayerProfile.mockResolvedValueOnce({ ...PROFILE, favorite_cricketer_name: null });
    const { findByText, queryByText } = await render(<PlayerProfileScreen />);

    await findByText('Asha Patel');
    expect(queryByText('Favorite Cricketer')).toBeNull();
  });

  it('shows an error state if the profile fails to load', async () => {
    mockGetPlayerProfile.mockRejectedValueOnce(new Error('not found'));
    const { findByTestId } = await render(<PlayerProfileScreen />);

    expect(await findByTestId('player-profile-error')).toBeTruthy();
  });

  // Backlog B-9: followers/following.
  describe('follow/unfollow', () => {
    it('shows follower and following counts', async () => {
      mockGetPlayerProfile.mockResolvedValueOnce(PROFILE);
      const { findByText } = await render(<PlayerProfileScreen />);

      expect(await findByText('3')).toBeTruthy();
      expect(await findByText('1')).toBeTruthy();
    });

    it('follows the player and updates the button and count', async () => {
      mockGetPlayerProfile.mockResolvedValueOnce(PROFILE);
      mockFollowPlayer.mockResolvedValueOnce({ following: true });

      const { findByTestId, findByText } = await render(<PlayerProfileScreen />);
      await fireEvent.press(await findByTestId('follow-toggle-button'));

      await waitFor(() => expect(mockFollowPlayer).toHaveBeenCalledWith('p1'));
      await findByText('4'); // followers_count incremented from 3 to 4
    });

    it('unfollows the player when already following', async () => {
      mockGetPlayerProfile.mockResolvedValueOnce({
        ...PROFILE,
        follow_summary: { ...PROFILE.follow_summary, is_following: true },
      });
      mockUnfollowPlayer.mockResolvedValueOnce({ following: false });

      const { findByTestId } = await render(<PlayerProfileScreen />);
      await fireEvent.press(await findByTestId('follow-toggle-button'));

      await waitFor(() => expect(mockUnfollowPlayer).toHaveBeenCalledWith('p1'));
    });

    it("hides the follow button on the viewer's own profile", async () => {
      mockGetPlayerProfile.mockResolvedValueOnce({ ...PROFILE, bfam_id: 'BF9999' });
      const { findByText, queryByTestId } = await render(<PlayerProfileScreen />);

      await findByText('Asha Patel');
      expect(queryByTestId('follow-toggle-button')).toBeNull();
    });

    it('shows an error without discarding the loaded profile if the toggle fails', async () => {
      mockGetPlayerProfile.mockResolvedValueOnce(PROFILE);
      mockFollowPlayer.mockRejectedValueOnce(new Error('network error'));

      const { findByTestId, findByText } = await render(<PlayerProfileScreen />);
      await fireEvent.press(await findByTestId('follow-toggle-button'));

      await findByTestId('follow-error');
      expect(await findByText('Asha Patel')).toBeTruthy();
    });
  });

  // Backlog B-12: reached via player search, a viewer can book a turf
  // straight from this profile.
  describe('Book a Turf', () => {
    it('routes to the one available turf while Discover stays hidden (backlog A-12)', async () => {
      mockGetPlayerProfile.mockResolvedValueOnce(PROFILE);
      mockGetTurfs.mockResolvedValueOnce({
        page: 1,
        page_size: 20,
        results: [{ turf_id: 'turf-1', turf_name: 'BFAM Ground' }],
      });

      const { findByTestId } = await render(<PlayerProfileScreen />);
      await fireEvent.press(await findByTestId('player-profile-book-turf-button'));

      await waitFor(() => expect(mockGetTurfs).toHaveBeenCalledWith({}));
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          '/(tabs)/discover/turf/turf-1/availability?turfName=BFAM%20Ground',
        ),
      );
    });

    it('shows an error if there is no turf to book yet', async () => {
      mockGetPlayerProfile.mockResolvedValueOnce(PROFILE);
      mockGetTurfs.mockResolvedValueOnce({ page: 1, page_size: 20, results: [] });

      const { findByTestId, findByText } = await render(<PlayerProfileScreen />);
      await fireEvent.press(await findByTestId('player-profile-book-turf-button'));

      await findByText(/no turf is available/i);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
