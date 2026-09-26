// A phone on the same Wi-Fi as the dev PC must find the backend even after
// the PC's LAN IP changes, without anyone editing .env.local.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null },
}));

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { devServerHost, getApiBaseUrl } from '../src/lib/apiBaseUrl';

const mockConstants = Constants as unknown as { expoConfig: { hostUri?: string } | null };

describe('devServerHost', () => {
  it('takes the IPv4 address out of Expo’s hostUri', () => {
    expect(devServerHost('192.168.1.10:8081')).toBe('192.168.1.10');
    expect(devServerHost('exp://192.168.1.10:8081')).toBe('192.168.1.10');
    expect(devServerHost('10.0.0.7')).toBe('10.0.0.7');
  });

  it('refuses a tunnel or DNS name — that is not the dev machine’s own address', () => {
    expect(devServerHost('abc-123.exp.direct:80')).toBeNull();
    expect(devServerHost('my-pc.local:8081')).toBeNull();
  });

  it('returns null when nothing usable is reported', () => {
    expect(devServerHost(undefined)).toBeNull();
    expect(devServerHost(null)).toBeNull();
    expect(devServerHost('')).toBeNull();
  });
});

describe('getApiBaseUrl (native, development)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    mockConstants.expoConfig = null;
  });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('follows the dev server’s address even when EXPO_PUBLIC_API_URL is a stale IP', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.5:5000';
    mockConstants.expoConfig = { hostUri: '192.168.1.10:8081' };
    expect(getApiBaseUrl()).toBe('http://192.168.1.10:5000');
  });

  it('falls back to EXPO_PUBLIC_API_URL when Expo reports no usable host (e.g. tunnel mode)', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.5:5000';
    mockConstants.expoConfig = { hostUri: 'abc-123.exp.direct:80' };
    expect(getApiBaseUrl()).toBe('http://192.168.1.5:5000');
  });

  it('falls back to localhost with neither', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe('http://localhost:5000');
  });
});

// The mobile app also ships as a website (`expo export -p web`). There the
// page is served from a static host, so "the page's own host on :5000" is
// wrong — the deployed API address must come from the build.
describe('getApiBaseUrl (web)', () => {
  const g = globalThis as unknown as { window?: unknown; __DEV__?: boolean };
  const originalWindow = g.window;
  const originalDev = g.__DEV__;
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const originalOS = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    g.window = { location: { protocol: 'https:', hostname: 'bfam-app.pages.dev' } };
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    g.window = originalWindow;
    g.__DEV__ = originalDev;
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('uses the API address baked in at build time for a production export', () => {
    g.__DEV__ = false;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('derives the host from the page in local development, ignoring a stale LAN IP in the env', () => {
    g.__DEV__ = true;
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.5:5000';
    g.window = { location: { protocol: 'http:', hostname: 'localhost' } };
    expect(getApiBaseUrl()).toBe('http://localhost:5000');
  });

  it('falls back to the page host on :5000 when a production export has no API address set', () => {
    g.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe('https://bfam-app.pages.dev:5000');
  });
});
