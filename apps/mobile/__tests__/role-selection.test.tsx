import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockCompleteAccountCreation = jest.fn();
jest.mock('../src/services/completeAccountCreation', () => ({
  completeAccountCreation: (...args: unknown[]) => mockCompleteAccountCreation(...args),
}));

import RoleSelection from '../app/role-selection';
import { useSignupStore } from '../src/store/signupStore';

// Sign-up is for players only. Turf Owner / Turf Staff accounts are created by
// a BFAM admin (or the turf owner), so there is no role to pick any more.
describe('RoleSelection screen (player-only sign-up)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSignupStore.getState().reset();
    useSignupStore.setState({ identifier: '+919876543210', password: 'SuperSecret123' });
  });

  it('offers no role cards — owners and staff are not self-service', async () => {
    const { queryByTestId } = await render(<RoleSelection />);

    for (const role of ['PLAYER', 'TURF_OWNER', 'TURF_STAFF', 'ADMIN']) {
      expect(queryByTestId(`role-card-${role}`)).toBeNull();
    }
  });

  it('requires the liability waiver before continuing', async () => {
    const { getByTestId, findByText } = await render(<RoleSelection />);

    await fireEvent.press(getByTestId('role-selection-continue'));

    await findByText(/accept the liability waiver/i);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('continues to Favorite Cricketer as a player once the waiver is accepted', async () => {
    const { getByTestId } = await render(<RoleSelection />);

    await fireEvent.press(getByTestId('waiver-checkbox'));
    await fireEvent.press(getByTestId('role-selection-continue'));

    expect(mockPush).toHaveBeenCalledWith('/favorite-cricketer');
    expect(useSignupStore.getState().role).toBe('PLAYER');
    // The account is created later, at the end of the player flow.
    expect(mockCompleteAccountCreation).not.toHaveBeenCalled();
  });

  it('still takes an optional referral code', async () => {
    const { getByTestId } = await render(<RoleSelection />);

    await fireEvent.changeText(getByTestId('referral-code-input'), 'BF1001');

    expect(useSignupStore.getState().referralCode).toBe('BF1001');
  });
});
