import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

// Push delivery (module 2.11, PRD §12.45 — "push notifications are the
// primary notification mechanism"). Best-effort: permission can be denied,
// and Expo push tokens aren't available on a simulator/emulator or web —
// none of that should ever block app usage, so every failure here is
// caught and swallowed rather than surfaced to the user.
export async function registerForPushNotifications(): Promise<void> {
  try {
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
