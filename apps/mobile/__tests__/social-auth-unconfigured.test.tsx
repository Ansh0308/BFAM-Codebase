import { Platform } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useGoogleSignIn } from '../src/services/socialAuth';

// Jest has no app manifest to read the URL scheme from.
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  createURL: (path: string) => `bfam://${path}`,
  resolveScheme: () => 'bfam',
}));

// With no Google OAuth credentials yet, expo-auth-session's Google provider throws while
// rendering ("Client Id property `androidClientId` must be defined…"). On a phone that
// replaced the whole Login screen with the "Something went wrong" crash page. The hook
// must stay quiet and report "not available" so the Google button is simply disabled.

describe('useGoogleSignIn without Google credentials', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  });

  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  it.each(['android', 'ios', 'web'] as const)('does not throw on %s', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    const { result } = await renderHook(() => useGoogleSignIn());
    expect(result.current.request).toBeNull();
  });
});
