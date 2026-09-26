import { Platform } from 'react-native';
import Constants from 'expo-constants';

// EXPO_PUBLIC_API_URL is meant for a physical device reaching the dev
// machine over LAN (e.g. http://192.168.1.6:5000) — inlined at build time,
// so it has to be a real, reachable IP, and that IP changes with whatever
// network the dev machine is on.
//
// On web, though, the app is SERVED BY the same machine as the backend —
// the browser already knows how to reach that host as `location.hostname`,
// and a stale/wrong LAN IP in EXPO_PUBLIC_API_URL (or one a sandboxed
// preview browser simply can't route to) silently breaks every request
// with no visible error beyond a hung "Logging in..." spinner. Deriving
// the web origin from the page itself instead of trusting the LAN-IP env
// var sidesteps that whole class of bug for the one platform where it's
// avoidable.
//
// Expo Go on a phone has the same problem and the same way out: the phone
// only got its JS bundle because it could reach the dev machine, and Expo
// tells the app that machine's address (`hostUri`, e.g. "192.168.1.10:8081").
// The backend runs on that same machine, so in development we use it instead
// of a hard-coded IP that goes stale every time the Wi-Fi network (and so the
// PC's address) changes — "can't log in from my phone" was exactly that.
const BACKEND_PORT = 5000;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// The dev machine's LAN IP as Expo reports it, or null when there isn't a
// usable one (production build, tunnel mode — a tunnel hostname isn't the
// machine's own address — or nothing reported).
export function devServerHost(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;
  const host = hostUri.replace(/^[a-z]+:\/\//i, '').split(/[:/]/)[0];
  return IPV4.test(host) ? host : null;
}

export function getApiBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
  }
  if (__DEV__) {
    const host = devServerHost(Constants.expoConfig?.hostUri);
    if (host) return `http://${host}:${BACKEND_PORT}`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? `http://localhost:${BACKEND_PORT}`;
}
