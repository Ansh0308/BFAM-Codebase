// Server-side verification of Google/Apple identity tokens (Stack §9.1).
// Verification only — account lookup/creation happens in app.ts using the
// verified identity fields these functions return.

import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

export interface VerifiedSocialIdentity {
  providerId: string;
  email: string | null;
  name: string | null;
}

function googleClientIds(): string[] {
  // Read lazily (not at module load) so tests can set env vars in
  // beforeEach and so a runtime .env reload is picked up.
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_IOS,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
  ].filter((id): id is string => Boolean(id));
}

/**
 * Verifies a Google ID token (obtained client-side via expo-auth-session)
 * and returns the verified identity. Throws if the token is invalid, or its
 * `aud` doesn't match one of our configured client ids.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedSocialIdentity> {
  const audience = googleClientIds();
  if (audience.length === 0) {
    throw new Error('Google sign-in is not configured on this server');
  }

  const googleClient = new OAuth2Client();
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error('Invalid Google ID token');
  }

  return {
    providerId: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
  };
}

/**
 * Verifies an Apple identity token (obtained client-side via
 * expo-apple-authentication). Apple only reliably includes `email` on the
 * user's FIRST authorization — subsequent sign-ins may omit it, so callers
 * must handle `email: null`.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<VerifiedSocialIdentity> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Apple sign-in is not configured on this server');
  }

  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: clientId,
    ignoreExpiration: false,
  });

  if (!payload?.sub) {
    throw new Error('Invalid Apple identity token');
  }

  return {
    providerId: payload.sub,
    email: payload.email ?? null,
    // Apple's identity token itself never carries a display name (that only
    // arrives once, separately, in the native SDK's user object on first
    // sign-in) — callers relying on a name for Apple must pass it through
    // from the client if available.
    name: null,
  };
}
