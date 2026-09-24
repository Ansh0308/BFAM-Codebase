import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

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

describe('RoleSelection screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSignupStore.getState().reset();
    useSignupStore.setState({ identifier: '+919876543210', password: 'SuperSecret123' });
  });

  it('renders exactly 3 role cards (no Admin)', async () => {
    const { getByTestId, queryByTestId } = await render(<RoleSelection />);
    expect(getByTestId('role-card-PLAYER')).toBeTruthy();
    expect(getByTestId('role-card-TURF_OWNER')).toBeTruthy();
    expect(getByTestId('role-card-TURF_STAFF')).toBeTruthy();
    expect(queryByTestId('role-card-ADMIN')).toBeNull();
  });

  // Long tail — Referral System (PRD §12.53).
  it('shows an optional referral code field for Player only, and stores what is typed', async () => {
    const { getByTestId, queryByTestId } = await render(<RoleSelection />);
    expect(queryByTestId('referral-code-input')).toBeNull();

    await fireEvent.press(getByTestId('role-card-TURF_OWNER'));
    expect(queryByTestId('referral-code-input')).toBeNull();

    await fireEvent.press(getByTestId('role-card-PLAYER'));
    await fireEvent.changeText(getByTestId('referral-code-input'), 'BF1001');
    expect(useSignupStore.getState().referralCode).toBe('BF1001');
  });

  it('selecting Player navigates to Favorite Cricketer instead of creating the account directly', async () => {
    const { getByTestId } = await render(<RoleSelection />);

    await fireEvent.press(getByTestId('role-card-PLAYER'));
    await fireEvent.press(getByTestId('waiver-checkbox'));
    await fireEvent.press(getByTestId('role-selection-continue'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/favorite-cricketer');
    });
    expect(mockCompleteAccountCreation).not.toHaveBeenCalled();
  });

  it('selecting Turf Owner creates the account directly, skipping Favorite Cricketer and BFAM ID Confirmation (no BFAM ID for this role)', async () => {
    mockCompleteAccountCreation.mockResolvedValueOnce({
      token: 'jwt-token',
      user_id: 'u1',
      bfam_id: null,
    });

    const { getByTestId } = await render(<RoleSelection />);

    await fireEvent.press(getByTestId('role-card-TURF_OWNER'));
    await fireEvent.press(getByTestId('waiver-checkbox'));
    await fireEvent.press(getByTestId('role-selection-continue'));

    await waitFor(() => {
      expect(mockCompleteAccountCreation).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'TURF_OWNER', waiverAccepted: true }),
      );
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/profile-setup');
    });
    expect(mockPush).not.toHaveBeenCalledWith('/favorite-cricketer');
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/bfam-id-confirmation' }),
    );
  });

  it('selecting Turf Staff creates the account directly, skipping Favorite Cricketer', async () => {
    mockCompleteAccountCreation.mockResolvedValueOnce({
      token: 'jwt-token',
      user_id: 'u2',
      bfam_id: null,
    });

    const { getByTestId } = await render(<RoleSelection />);

    await fireEvent.press(getByTestId('role-card-TURF_STAFF'));
    await fireEvent.press(getByTestId('waiver-checkbox'));
    await fireEvent.press(getByTestId('role-selection-continue'));

    await waitFor(() => {
      expect(mockCompleteAccountCreation).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'TURF_STAFF', waiverAccepted: true }),
      );
    });
    expect(mockPush).not.toHaveBeenCalledWith('/favorite-cricketer');
  });

  it('blocks Continue until the liability waiver is checked (PRD §32.9)', async () => {
    const { getByTestId, findByText } = await render(<RoleSelection />);

    await fireEvent.press(getByTestId('role-card-TURF_OWNER'));
    await fireEvent.press(getByTestId('role-selection-continue'));

    expect(await findByText(/accept the liability waiver/i)).toBeTruthy();
    expect(mockCompleteAccountCreation).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('waiver-checkbox'));
    await fireEvent.press(getByTestId('role-selection-continue'));

    await waitFor(() => expect(mockCompleteAccountCreation).toHaveBeenCalled());
  });
});
