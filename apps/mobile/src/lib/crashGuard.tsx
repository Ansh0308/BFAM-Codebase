import React from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';

// A release build that hits a JavaScript error simply closes, which tells a tester
// (and us) nothing. This shows the error instead:
//  - installCrashGuard(): a last-resort handler for errors outside React rendering
//    (startup code, event handlers) that pops the message up before the app closes;
//  - CrashBoundary: catches errors thrown while rendering and shows them on screen.
// Native (non-JavaScript) crashes cannot be caught from here.
let installed = false;

export function installCrashGuard() {
  if (installed || Platform.OS === 'web') return;
  installed = true;
  const errorUtils = (
    globalThis as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (e: Error, fatal?: boolean) => void;
        setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    try {
      Alert.alert(
        isFatal ? 'BFAM hit an error and must close' : 'BFAM hit an error',
        `${error?.message ?? String(error)}\n\nPlease screenshot this and send it to the team.`,
        [{ text: 'OK', onPress: () => previous(error, isFatal) }],
        { cancelable: false },
      );
    } catch {
      previous(error, isFatal);
    }
  });
}

export class CrashBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 24, paddingTop: 64 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#0B0B0B' }}>
          Something went wrong
        </Text>
        <Text style={{ marginTop: 8, color: '#555555' }}>
          Please screenshot this screen and send it to the team.
        </Text>
        <ScrollView style={{ marginTop: 16 }}>
          <Text selectable style={{ color: '#D80000' }}>
            {error.message}
            {'\n\n'}
            {error.stack?.split('\n').slice(0, 12).join('\n')}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
