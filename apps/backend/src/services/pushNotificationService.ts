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
