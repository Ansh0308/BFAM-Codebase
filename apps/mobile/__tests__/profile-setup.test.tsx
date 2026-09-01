import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://picked-photo.jpg' }],
  }),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockGetMyProfile = jest.fn();
const mockUpdateMyProfile = jest.fn();
const mockUploadProfilePhoto = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
    updateMyProfile: (...args: unknown[]) => mockUpdateMyProfile(...args),
    uploadProfilePhoto: (...args: unknown[]) => mockUploadProfilePhoto(...args),
  },
}));

import ProfileSetup from '../app/profile-setup';
import { useAuthStore } from '../src/store/authStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function selectDateOfBirth(findByTestId: (id: string) => Promise<any>) {
  fireEvent.press(await findByTestId('date-of-birth-trigger'));
  fireEvent.press(await findByTestId('date-of-birth-day-option-15'));
  fireEvent.press(await findByTestId('date-of-birth-month-option-06'));
  fireEvent.press(await findByTestId('date-of-birth-year-option-2000'));
  fireEvent.press(await findByTestId('date-of-birth-done'));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fillRequiredPlayerFields(findByTestId: (id: string) => Promise<any>) {
  fireEvent.press(await findByTestId('gender-FEMALE'));
  await selectDateOfBirth(findByTestId);
}

const EMPTY_PROFILE = {
  user_id: 'u1',
  bfam_id: 'BF1000',
  role: 'PLAYER',
  phone_number: '+919876543210',
  email: null,
  profile_photo_url: null,
  city: null,
  preferred_language: null,
  playing_role: null,
  batting_style: null,
  bowling_style: null,
  experience_level: null,
  skill_rating: null,
  reliability_score: null,
  favorite_cricketer_name: null,
  favorite_cricketer_external_id: null,
};

describe('ProfileSetup screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyProfile.mockResolvedValue(EMPTY_PROFILE);
    mockUpdateMyProfile.mockResolvedValue(EMPTY_PROFILE);
    mockUploadProfilePhoto.mockResolvedValue({
      profile_photo_url:
        'https://bfam-uploads.s3.ap-south-1.amazonaws.com/profile-photos/u1/fake.jpg',
    });
  });

  it('shows cricket-specific fields for a PLAYER account', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId } = render(<ProfileSetup />);

    await findByTestId('playing-role');
    await findByTestId('batting-style');
    await findByTestId('bowling-style');
    await findByTestId('experience-level');
  });

  it('hides cricket-specific fields for a TURF_OWNER account', async () => {
    useAuthStore.setState({ user: { user_id: 'u2', bfam_id: null, role: 'TURF_OWNER' } });

    const { queryByTestId, findByTestId } = render(<ProfileSetup />);

    await findByTestId('profile-setup-save');
    expect(queryByTestId('playing-role')).toBeNull();
    expect(queryByTestId('batting-style')).toBeNull();
  });

  it('picking a photo uploads it and persists the hosted URL on save', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId, queryByTestId } = render(<ProfileSetup />);

    const picker = await findByTestId('profile-photo-picker');
    fireEvent.press(picker);

    await waitFor(() => {
      expect(mockUploadProfilePhoto).toHaveBeenCalledWith('file://picked-photo.jpg', 'image/jpeg');
    });
    expect(queryByTestId('profile-photo-not-hosted-note')).toBeNull();

    await fillRequiredPlayerFields(findByTestId);
    const saveButton = await findByTestId('profile-setup-save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_photo_url:
            'https://bfam-uploads.s3.ap-south-1.amazonaws.com/profile-photos/u1/fake.jpg',
        }),
      );
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/session-active');
    });
  });

  it('falls back to the local photo URI and shows a note when the server has no photo storage configured', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    const notConfiguredError = new Error('Not configured') as Error & { status?: number };
    notConfiguredError.status = 501;
    mockUploadProfilePhoto.mockRejectedValueOnce(notConfiguredError);

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('profile-photo-picker'));

    await findByTestId('profile-photo-not-hosted-note');

    await fillRequiredPlayerFields(findByTestId);
    fireEvent.press(await findByTestId('profile-setup-save'));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({ profile_photo_url: 'file://picked-photo.jpg' }),
      );
    });
  });

  it('picking an avatar preset saves the preset sentinel without uploading', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('avatar-preset-bat-red'));
    await fillRequiredPlayerFields(findByTestId);
    fireEvent.press(await findByTestId('profile-setup-save'));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({ profile_photo_url: 'preset:bat-red' }),
      );
    });
    expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
  });

  it('picking an avatar preset after a real photo replaces the photo selection', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('profile-photo-picker'));
    await waitFor(() => expect(mockUploadProfilePhoto).toHaveBeenCalled());

    fireEvent.press(await findByTestId('avatar-preset-ball-ink'));
    await fillRequiredPlayerFields(findByTestId);
    fireEvent.press(await findByTestId('profile-setup-save'));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({ profile_photo_url: 'preset:ball-ink' }),
      );
    });
  });

  it('shows a generic error if the photo upload itself fails unexpectedly', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    mockUploadProfilePhoto.mockRejectedValueOnce(new Error('network error'));

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('profile-photo-picker'));

    await findByTestId('profile-setup-error');
  });

  it('selecting playing role, batting style, and experience saves them for a player', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('playing-role-BOWLER'));
    fireEvent.press(await findByTestId('batting-style-LEFT_HANDED'));
    fireEvent.press(await findByTestId('experience-level-ADVANCED'));

    fireEvent.press(await findByTestId('bowling-style-LEFT_ARM'));

    await fillRequiredPlayerFields(findByTestId);
    fireEvent.press(await findByTestId('profile-setup-save'));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          playing_role: 'BOWLER',
          batting_style: 'LEFT_HANDED',
          bowling_style: 'LEFT_ARM',
          experience_level: 'ADVANCED',
          date_of_birth: '2000-06-15',
          gender: 'FEMALE',
        }),
      );
    });
  });

  it('requires gender for a player and blocks saving without it', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId } = render(<ProfileSetup />);

    await selectDateOfBirth(findByTestId);
    fireEvent.press(await findByTestId('profile-setup-save'));

    const error = await findByTestId('profile-setup-error');
    expect(error.props.children).toMatch(/gender/i);
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('requires date of birth for a player and blocks saving without it', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('gender-MALE'));
    fireEvent.press(await findByTestId('profile-setup-save'));

    const error = await findByTestId('profile-setup-error');
    expect(error.props.children).toMatch(/date of birth/i);
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('does not require date of birth for a non-player account', async () => {
    useAuthStore.setState({ user: { user_id: 'u2', bfam_id: null, role: 'TURF_OWNER' } });
    mockGetMyProfile.mockResolvedValue({ ...EMPTY_PROFILE, role: 'TURF_OWNER', bfam_id: null });

    const { findByTestId } = render(<ProfileSetup />);

    fireEvent.press(await findByTestId('profile-setup-save'));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalled();
    });
  });

  it('shows an error and stays on screen if saving fails', async () => {
    useAuthStore.setState({ user: { user_id: 'u1', bfam_id: 'BF1000', role: 'PLAYER' } });
    mockUpdateMyProfile.mockRejectedValueOnce(new Error('network error'));

    const { findByTestId } = render(<ProfileSetup />);

    await fillRequiredPlayerFields(findByTestId);
    fireEvent.press(await findByTestId('profile-setup-save'));

    await findByTestId('profile-setup-error');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
