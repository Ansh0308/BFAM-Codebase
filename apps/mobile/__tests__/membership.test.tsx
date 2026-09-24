import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMembershipPlans: jest.fn(),
    getMyMembership: jest.fn(),
    getMyProfile: jest.fn(),
    subscribeToMembership: jest.fn(),
  },
}));

const mockConfirm = jest.fn();
jest.mock('../src/lib/confirm', () => ({
  confirmAction: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockPlans = apiClient.getMembershipPlans as jest.Mock;
const mockMine = apiClient.getMyMembership as jest.Mock;
const mockProfile = apiClient.getMyProfile as jest.Mock;
const mockSubscribe = apiClient.subscribeToMembership as jest.Mock;

import MembershipScreen from '../app/membership';

const PLANS = {
  results: [
    {
      plan_id: 'p1',
      name: 'Monthly Member',
      duration_days: 30,
      coin_cost: 1500,
      discount_percent: 10,
    },
    {
      plan_id: 'p2',
      name: 'Annual Member',
      duration_days: 365,
      coin_cost: 12000,
      discount_percent: 15,
    },
  ],
};

// Long tail — Memberships (PRD §12.51).
describe('MembershipScreen', () => {
  beforeEach(() => {
    [mockPlans, mockMine, mockProfile, mockSubscribe, mockConfirm].forEach((m) => m.mockReset());
    mockPlans.mockResolvedValue(PLANS);
    mockMine.mockResolvedValue({ membership: null });
    mockProfile.mockResolvedValue({ coin_balance: 2000 });
    mockConfirm.mockResolvedValue(true);
  });

  it('lists the plans and balance', async () => {
    const { findByText, findByTestId } = await render(<MembershipScreen />);
    expect(await findByText('Monthly Member')).toBeTruthy();
    expect(await findByText('Annual Member')).toBeTruthy();
    expect((await findByTestId('membership-coins')).props.children.join('')).toContain('2000');
  });

  it('subscribes to an affordable plan and shows the active membership', async () => {
    mockSubscribe.mockResolvedValueOnce({
      membership_id: 'm',
      plan_name: 'Monthly Member',
      expires_at: '2026-10-24T00:00:00.000Z',
      coin_balance: 500,
    });
    mockMine.mockResolvedValueOnce({ membership: null }).mockResolvedValueOnce({
      membership: {
        membership_id: 'm',
        plan_name: 'Monthly Member',
        discount_percent: 10,
        started_at: '2026-09-24T00:00:00.000Z',
        expires_at: '2026-10-24T00:00:00.000Z',
      },
    });
    const { findByTestId } = await render(<MembershipScreen />);
    await fireEvent.press(await findByTestId('subscribe-p1'));

    await waitFor(() => expect(mockSubscribe).toHaveBeenCalledWith('p1'));
    expect(await findByTestId('membership-active')).toBeTruthy();
    expect((await findByTestId('membership-coins')).props.children.join('')).toContain('500');
  });

  it('does not subscribe when the confirmation is declined', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const { findByTestId } = await render(<MembershipScreen />);
    await fireEvent.press(await findByTestId('subscribe-p1'));
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('will not subscribe to a plan the player cannot afford', async () => {
    const { findByTestId } = await render(<MembershipScreen />);
    await fireEvent.press(await findByTestId('subscribe-p2'));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('shows an error when loading fails', async () => {
    mockPlans.mockRejectedValueOnce(new Error('x'));
    const { findByText } = await render(<MembershipScreen />);
    expect(await findByText(/could not load membership/i)).toBeTruthy();
  });
});
