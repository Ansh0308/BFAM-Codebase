import axios from 'axios';

const expoPushTokenPattern =
  /^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$/;

const registeredTokens = new Map<string, Set<string>>();

export function registerExpoPushToken(userId: string, token: string) {
  if (!expoPushTokenPattern.test(token)) {
    throw new Error('Invalid Expo push token');
  }

  const tokens = registeredTokens.get(userId) ?? new Set<string>();
  tokens.add(token);
  registeredTokens.set(userId, tokens);

  return { user_id: userId, token, registered: true };
}

export function getRegisteredExpoPushTokens(userId: string) {
  return Array.from(registeredTokens.get(userId) ?? []);
}

// Push delivery (module 2.11, PRD §12.45 — "push notifications are the
// primary notification mechanism"). Real delivery via Expo's push API
// outside tests; a console-only mock in tests, same convention as
// smsService's MSG91 fallback, so the test suite never makes real network
// calls. A delivery failure is logged, never thrown — the notifications
// row (this module's in-app log) already exists regardless of whether the
// push itself succeeds.
export async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  if (tokens.length === 0) return false;

  if (process.env.NODE_ENV === 'test') {
    console.log(`[MOCK PUSH] ${tokens.length} device(s): ${title} — ${body}`);
    return true;
  }

  try {
    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      tokens.map((to) => ({ to, title, body, data })),
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
    );
    return true;
  } catch (error) {
    console.error('[pushNotificationService] Expo push delivery failed:', error);
    return false;
  }
}
