// Wraps expo-auth-session's Google provider and expo-apple-authentication
// to obtain a Google id_token / Apple identityToken client-side, then hands
// them to the api-client (apps/mobile/src/lib/apiClient.ts) to be verified
// server-side (POST /auth/google, /auth/apple — see
// apps/backend/src/services/socialAuthService.ts).
//
// NOTE: expo-auth-session's Google provider is a HOOK (useIdTokenAuthRequest)
// — it must be called from inside a React component, so useGoogleSignIn()
// below is a hook, not a plain async function like the Apple side.

import { Platform } from 'react-native';
import { useIdTokenAuthRequest as useGoogleIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

// Required once per app for the auth session to correctly dismiss the
// in-app browser after redirect on native platforms.
WebBrowser.maybeCompleteAuthSession();

export interface GoogleSignInResult {
  idToken: string;
}

/**
 * Hook: returns `{ request, promptAsync }`. Call `promptAsync()` from a
 * button handler; on success it resolves an `AuthSessionResult` whose
 * `params.id_token` is the Google ID token to send to POST /auth/google.
 */
export function useGoogleSignIn() {
  // On web specifically, expo-auth-session's Google provider throws
  // synchronously (during render, inside a useMemo) if webClientId is
  // missing — "Client Id property `webClientId` must be defined to use
  // Google auth on this platform." Until real Google OAuth credentials
  // exist for this project, EXPO_PUBLIC_GOOGLE_CLIENT_ID is legitimately
  // unset, so we pass a placeholder to avoid the crash and instead report
  // "not available" via `request: null` — the caller already disables the
  // Google button when `request` is falsy (see app/login.tsx).
  const isConfigured = Boolean(
    Platform.OS === 'web'
      ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
      : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
          process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  );

  const [request, response, promptAsync] = useGoogleIdTokenAuthRequest({
    // Per-platform client IDs — required for expo-auth-session's Google
    // provider to construct the correct native/web auth request. Only the
    // id_token audience actually matters server-side (see
    // GOOGLE_CLIENT_ID/_IOS/_ANDROID in apps/backend/.env.example) — these
    // client-side values must match those server-configured audiences.
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'unconfigured-web-client-id',
  });

  return { request: isConfigured ? request : null, response, promptAsync };
}

export function extractGoogleIdToken(response: unknown): string | null {
  const params = (response as { params?: { id_token?: string } } | null)?.params;
  return params?.id_token ?? null;
}

export interface AppleSignInResult {
  identityToken: string;
  fullName: string | null;
}

/**
 * Triggers the native Apple Sign In sheet and returns the identity token to
 * send to POST /auth/apple. Apple only supplies `fullName` on the user's
 * FIRST authorization ever — every subsequent sign-in omits it, so callers
 * must not assume it's present.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token');
  }

  const fullName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
    : null;

  return { identityToken: credential.identityToken, fullName: fullName || null };
}
