import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://picked-logo.jpg', mimeType: 'image/jpeg' }],
  }),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockCreateTeam = jest.fn();
const mockUploadTeamLogo = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    createTeam: (...args: unknown[]) => mockCreateTeam(...args),
    uploadTeamLogo: (...args: unknown[]) => mockUploadTeamLogo(...args),
  },
}));

import CreateTeamScreen from '../app/(tabs)/teams/create';

describe('Create Team screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTeam.mockResolvedValue({ team_id: 'new-team-1' });
    mockUploadTeamLogo.mockResolvedValue({ team_logo_url: 'https://cdn.example.com/logo.jpg' });
  });

  it('has a back button, since there is no native header on this screen', async () => {
    const { findByTestId } = await render(<CreateTeamScreen />);

    await fireEvent.press(await findByTestId('screen-header-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('submits team_logo_url as null when no logo was picked', async () => {
    const { getByTestId } = await render(<CreateTeamScreen />);

    await fireEvent.changeText(getByTestId('team-name-input'), 'Elite XI');
    await fireEvent.press(getByTestId('submit-create-team'));

    await waitFor(() =>
      expect(mockCreateTeam).toHaveBeenCalledWith(expect.objectContaining({ team_logo_url: null })),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/teams/new-team-1');
  });

  it('picks, uploads and submits a team logo', async () => {
    const { getByTestId, findByTestId } = await render(<CreateTeamScreen />);

    await fireEvent.press(getByTestId('team-logo-picker'));
    await waitFor(() =>
      expect(mockUploadTeamLogo).toHaveBeenCalledWith('file://picked-logo.jpg', 'image/jpeg'),
    );

    await fireEvent.changeText(getByTestId('team-name-input'), 'Elite XI');
    await fireEvent.press(await findByTestId('submit-create-team'));

    await waitFor(() =>
      expect(mockCreateTeam).toHaveBeenCalledWith(
        expect.objectContaining({ team_logo_url: 'https://cdn.example.com/logo.jpg' }),
      ),
    );
  });

  it('keeps the locally-picked logo URI when the server has no photo storage configured', async () => {
    const notConfiguredError = new Error('Not configured') as Error & { status?: number };
    notConfiguredError.status = 501;
    mockUploadTeamLogo.mockRejectedValueOnce(notConfiguredError);

    const { getByTestId } = await render(<CreateTeamScreen />);

    await fireEvent.press(getByTestId('team-logo-picker'));
    await waitFor(() => expect(mockUploadTeamLogo).toHaveBeenCalled());

    await fireEvent.changeText(getByTestId('team-name-input'), 'Elite XI');
    await fireEvent.press(getByTestId('submit-create-team'));

    await waitFor(() =>
      expect(mockCreateTeam).toHaveBeenCalledWith(
        expect.objectContaining({ team_logo_url: 'file://picked-logo.jpg' }),
      ),
    );
  });

  it('selects a skill level chip', async () => {
    const { getByTestId } = await render(<CreateTeamScreen />);

    await fireEvent.press(getByTestId('skill-level-ADVANCED'));
    await fireEvent.changeText(getByTestId('team-name-input'), 'Elite XI');
    await fireEvent.press(getByTestId('submit-create-team'));

    await waitFor(() =>
      expect(mockCreateTeam).toHaveBeenCalledWith(
        expect.objectContaining({ skill_level: 'ADVANCED' }),
      ),
    );
  });

  it('hides the "open for players" info card and minimum rating field when toggled off', async () => {
    const { getByTestId, queryByTestId } = await render(<CreateTeamScreen />);

    expect(queryByTestId('open-for-players-info')).not.toBeNull();
    expect(queryByTestId('min-skill-rating-input')).not.toBeNull();

    await fireEvent.press(getByTestId('is-open-toggle-switch'));

    expect(queryByTestId('open-for-players-info')).toBeNull();
    expect(queryByTestId('min-skill-rating-input')).toBeNull();
  });
});
