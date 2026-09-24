import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: { getMyReferrals: jest.fn() },
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: { bfam_id: string } }) => unknown) =>
    selector({ user: { bfam_id: 'BF1001' } }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockGetMyReferrals = apiClient.getMyReferrals as jest.Mock;

import ReferralsScreen from '../app/referrals';

// Long tail — Referral System (PRD §12.53).
describe('ReferralsScreen', () => {
  beforeEach(() => {
    mockGetMyReferrals.mockReset();
    mockBack.mockReset();
  });

  it("shows the player's own BFAM ID as their referral code", async () => {
    mockGetMyReferrals.mockResolvedValueOnce({ results: [] });
    const { findByTestId } = await render(<ReferralsScreen />);
    expect((await findByTestId('referral-code')).props.children).toBe('BF1001');
    expect(await findByTestId('referrals-empty')).toBeTruthy();
  });

  it('lists referrals with reward status', async () => {
    mockGetMyReferrals.mockResolvedValueOnce({
      results: [
        {
          referral_id: 'r1',
          referred_player_id: 'p2',
          referred_bfam_id: 'BF1002',
          referred_full_name: 'Rohan Mehta',
          status: 'QUALIFIED',
          reward_coins: 100,
          created_at: '',
          qualified_at: '',
        },
        {
          referral_id: 'r2',
          referred_player_id: 'p3',
          referred_bfam_id: 'BF1003',
          referred_full_name: null,
          status: 'PENDING',
          reward_coins: null,
          created_at: '',
          qualified_at: null,
        },
      ],
    });
    const { findByText } = await render(<ReferralsScreen />);
    expect(await findByText('Rohan Mehta')).toBeTruthy();
    expect(await findByText('+100 coins')).toBeTruthy();
    expect(await findByText('BF1003')).toBeTruthy();
    expect(await findByText('Pending')).toBeTruthy();
  });

  it('shows an error when loading fails, and goes back', async () => {
    mockGetMyReferrals.mockRejectedValueOnce(new Error('x'));
    const { findByText, findByTestId } = await render(<ReferralsScreen />);
    expect(await findByText(/could not load your referrals/i)).toBeTruthy();
    await fireEvent.press(await findByTestId('referrals-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
