import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getRewards: jest.fn(),
    getMyRedemptions: jest.fn(),
    getMyProfile: jest.fn(),
    redeemReward: jest.fn(),
  },
}));

const mockConfirm = jest.fn();
jest.mock('../src/lib/confirm', () => ({
  confirmAction: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockGetRewards = apiClient.getRewards as jest.Mock;
const mockGetMyRedemptions = apiClient.getMyRedemptions as jest.Mock;
const mockGetMyProfile = apiClient.getMyProfile as jest.Mock;
const mockRedeemReward = apiClient.redeemReward as jest.Mock;

import RewardsScreen from '../app/rewards';

const REWARDS = {
  results: [
    {
      reward_id: 'r1',
      name: 'Priority Booking Pass',
      description: 'Skip the queue',
      coin_cost: 500,
    },
    { reward_id: 'r2', name: 'BFAM Cap', description: null, coin_cost: 1000 },
  ],
};

// Long tail — Rewards catalog (PRD §12.36).
describe('RewardsScreen', () => {
  beforeEach(() => {
    [mockGetRewards, mockGetMyRedemptions, mockGetMyProfile, mockRedeemReward, mockConfirm].forEach(
      (m) => m.mockReset(),
    );
    mockGetRewards.mockResolvedValue(REWARDS);
    mockGetMyRedemptions.mockResolvedValue({ results: [] });
    mockGetMyProfile.mockResolvedValue({ coin_balance: 600 });
    mockConfirm.mockResolvedValue(true);
  });

  it('shows the balance and every reward', async () => {
    const { findByText, findByTestId } = await render(<RewardsScreen />);
    expect(await findByText('Priority Booking Pass')).toBeTruthy();
    expect(await findByText('BFAM Cap')).toBeTruthy();
    expect((await findByTestId('rewards-coins')).props.children.join('')).toContain('600');
  });

  it('redeems an affordable reward and updates the balance', async () => {
    mockRedeemReward.mockResolvedValueOnce({
      redemption_id: 'x',
      reward_name: 'Priority Booking Pass',
      coin_balance: 100,
    });
    const { findByTestId, findByText } = await render(<RewardsScreen />);
    await fireEvent.press(await findByTestId('redeem-r1'));

    await waitFor(() => expect(mockRedeemReward).toHaveBeenCalledWith('r1'));
    expect(await findByText(/Redeemed "Priority Booking Pass"/)).toBeTruthy();
    expect((await findByTestId('rewards-coins')).props.children.join('')).toContain('100');
  });

  it('does not redeem when the confirmation is declined', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const { findByTestId } = await render(<RewardsScreen />);
    await fireEvent.press(await findByTestId('redeem-r1'));
    expect(mockRedeemReward).not.toHaveBeenCalled();
  });

  it('disables redeeming a reward the player cannot afford', async () => {
    const { findByTestId } = await render(<RewardsScreen />);
    await fireEvent.press(await findByTestId('redeem-r2'));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('shows an error when loading fails', async () => {
    mockGetRewards.mockRejectedValueOnce(new Error('x'));
    const { findByText } = await render(<RewardsScreen />);
    expect(await findByText(/could not load rewards/i)).toBeTruthy();
  });
});
