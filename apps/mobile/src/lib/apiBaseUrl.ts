import { Platform } from 'react-native';

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
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';
}
