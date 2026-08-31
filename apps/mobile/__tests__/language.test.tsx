import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockGetMyProfile = jest.fn();
const mockUpdateMyProfile = jest.fn();
jest.mock('../src/lib/apiClient', () => ({
  apiClient: {
    getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
    updateMyProfile: (...args: unknown[]) => mockUpdateMyProfile(...args),
  },
}));

import Language from '../app/language';

describe('Language screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyProfile.mockResolvedValue({ preferred_language: 'en' });
    mockUpdateMyProfile.mockResolvedValue({});
  });

  it('marks the saved language as selected once loaded', async () => {
    const { findByTestId } = render(<Language />);
    await findByTestId('language-check-en');
  });

  it('persists the new language via updateMyProfile when a different option is picked', async () => {
    const { findByTestId } = render(<Language />);
    await findByTestId('language-check-en');

    fireEvent.press(await findByTestId('language-option-hi'));

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledWith({ preferred_language: 'hi' });
    });
    await findByTestId('language-check-hi');
  });
});
