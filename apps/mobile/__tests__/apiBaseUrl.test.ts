// A phone on the same Wi-Fi as the dev PC must find the backend even after
// the PC's LAN IP changes, without anyone editing .env.local.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null },
}));

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
