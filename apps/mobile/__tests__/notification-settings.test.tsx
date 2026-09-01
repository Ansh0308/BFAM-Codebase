import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

import NotificationSettings from '../app/notification-settings';

describe('NotificationSettings screen', () => {
  it('toggles each preference switch independently', () => {
    const { getByTestId } = render(<NotificationSettings />);

    const matchUpdates = getByTestId('toggle-match-updates-switch');
    const promotions = getByTestId('toggle-promotions-switch');

    expect(matchUpdates.props.accessibilityState.checked).toBe(true);
    expect(promotions.props.accessibilityState.checked).toBe(false);

    fireEvent.press(matchUpdates);
    fireEvent.press(promotions);

    expect(getByTestId('toggle-match-updates-switch').props.accessibilityState.checked).toBe(false);
    expect(getByTestId('toggle-promotions-switch').props.accessibilityState.checked).toBe(true);
  });
});
