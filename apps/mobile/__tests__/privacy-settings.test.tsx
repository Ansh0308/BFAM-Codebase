import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

import PrivacySettings from '../app/privacy-settings';

describe('PrivacySettings screen', () => {
  it('toggles each preference switch independently', () => {
    const { getByTestId } = render(<PrivacySettings />);

    const publicProfile = getByTestId('toggle-public-profile-switch');
    expect(publicProfile.props.accessibilityState.checked).toBe(true);

    fireEvent.press(publicProfile);

    expect(getByTestId('toggle-public-profile-switch').props.accessibilityState.checked).toBe(
      false,
    );
    expect(getByTestId('toggle-public-stats-switch').props.accessibilityState.checked).toBe(true);
  });
});
