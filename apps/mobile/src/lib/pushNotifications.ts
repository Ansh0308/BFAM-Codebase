import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { apiClient } from './apiClient';

// Push delivery (module 2.11, PRD §12.45 — "push notifications are the
// primary notification mechanism"). Best-effort: permission can be denied,
// and Expo push tokens aren't available on a simulator/emulator or web —
// none of that should ever block app usage, so every failure here is
// caught and swallowed rather than surfaced to the user.
//
// expo-notifications is imported lazily (inside the try block) rather than
// statically at module scope: in Expo Go on Android (SDK 53+), merely
// importing it triggers a synchronous throw at module-eval time (push
// notifications were removed from Expo Go entirely), which would otherwise
// crash this module's importers — including the root layout — before this
// function is ever called. A dynamic import turns that throw into a
// rejected promise this try/catch can actually catch.
//
// That's not enough on its own, though: on Android, expo-notifications'
// own getExpoPushTokenAsync() internally wires up a native token-refresh
// listener whose Expo-Go-unsupported check throws from inside that
// internal setup, not from the promise chain this function awaits — so it
// surfaces as an uncaught error/red screen even with the try/catch here.
// The only real fix is to never call it in Expo Go at all, detected via
// Constants.executionEnvironment (StoreClient = running inside Expo Go
// itself, as opposed to a standalone/dev-client build).
export async function registerForPushNotifications(): Promise<void> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  try {
    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await apiClient.registerExpoPushToken(token);
  } catch {
    // Simulator/emulator, web, denied permission, or a transient network
    // failure — the app works fine without push either way.
  }
}
