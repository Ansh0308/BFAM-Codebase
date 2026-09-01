import '../global.css';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Inter_500Medium, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import * as Sentry from '@sentry/react-native';
import { useAuthStore } from '../src/store/authStore';

// Font loading + Sentry init, moved here from the retired App.tsx now that
// expo-router owns the root navigator (app/_layout.tsx is the new entry
// point wired via package.json's "main": "expo-router/entry").
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
  });
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Anton: Anton_400Regular,
    'Archivo Black': ArchivoBlack_400Regular,
    Inter: Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  });

  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!fontsLoaded || isHydrating) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#D80000" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

// Only wrap with Sentry when it's actually initialized — wrapping
// unconditionally makes Sentry's performance/web-vitals instrumentation run
// against an uninitialized client, which throws
// ("Cannot read properties of undefined (reading 'startTime')") in dev
// environments that don't set EXPO_PUBLIC_SENTRY_DSN.
export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
