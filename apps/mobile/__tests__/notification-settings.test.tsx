import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../src/lib/apiClient';

jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getNotificationPreferences: jest.fn(),
    updateNotificationPreferences: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockGetPreferences = apiClient.getNotificationPreferences as jest.Mock;
const mockUpdatePreferences = apiClient.updateNotificationPreferences as jest.Mock;

import NotificationSettings from '../app/notification-settings';

describe('NotificationSettings screen (module 2.11 — persisted, not local-state)', () => {
  beforeEach(() => {
    mockGetPreferences.mockReset();
    mockUpdatePreferences.mockReset();
  });

  it('loads preferences from the backend and reflects each toggle', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      match_updates: true,
      booking_reminders: true,
      team_invites: true,
      promotions: false,
    });

    const { getByTestId, queryByTestId } = render(<NotificationSettings />);

    await waitFor(() => expect(queryByTestId('notification-settings-loading')).toBeNull());

    expect(getByTestId('toggle-match-updates-switch').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('toggle-promotions-switch').props.accessibilityState.checked).toBe(false);
  });

  it('persists a toggle flip via PATCH /notifications/preferences', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      match_updates: true,
      booking_reminders: true,
      team_invites: true,
      promotions: false,
    });
    mockUpdatePreferences.mockResolvedValueOnce({
      match_updates: true,
      booking_reminders: true,
      team_invites: true,
      promotions: true,
    });

    const { getByTestId, queryByTestId } = render(<NotificationSettings />);
    await waitFor(() => expect(queryByTestId('notification-settings-loading')).toBeNull());

    fireEvent.press(getByTestId('toggle-promotions-switch'));

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ promotions: true }));
    expect(getByTestId('toggle-promotions-switch').props.accessibilityState.checked).toBe(true);
  });

  it('rolls back the toggle if the save fails', async () => {
    mockGetPreferences.mockResolvedValueOnce({
      match_updates: true,
      booking_reminders: true,
      team_invites: true,
      promotions: false,
    });
    mockUpdatePreferences.mockRejectedValueOnce(new Error('network error'));

    const { getByTestId, queryByTestId } = render(<NotificationSettings />);
    await waitFor(() => expect(queryByTestId('notification-settings-loading')).toBeNull());

    fireEvent.press(getByTestId('toggle-promotions-switch'));
    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalled());

    await waitFor(() =>
      expect(getByTestId('toggle-promotions-switch').props.accessibilityState.checked).toBe(false),
    );
  });

  it('shows an error state when preferences fail to load', async () => {
    mockGetPreferences.mockRejectedValueOnce(new Error('network error'));

    const { findByText } = render(<NotificationSettings />);
    expect(await findByText(/could not load/i)).toBeTruthy();
  });
});
