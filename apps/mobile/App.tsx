import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { Inter_500Medium, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
  });
}

function App() {
  const [fontsLoaded] = useFonts({
    Anton: Anton_400Regular,
    'Archivo Black': ArchivoBlack_400Regular,
    Inter: Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D80000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default Sentry.wrap(App);
