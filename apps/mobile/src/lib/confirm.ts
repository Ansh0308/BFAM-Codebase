import { Alert, Platform } from 'react-native';

// React Native's own Alert.alert() is a documented no-op on web —
// react-native-web never implements it, so a confirm-before-destructive-
// action flow (e.g. Leave Team) silently does nothing when tapped on web,
// with no error to explain why. `window.confirm` is the equivalent on that
// platform. Centralized here so every future confirm-before-destructive
// flow gets this for free instead of rediscovering the same bug.
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Confirm',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
