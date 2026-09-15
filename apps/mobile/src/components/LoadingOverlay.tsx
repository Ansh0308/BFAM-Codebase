import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { MotiView } from 'moti';
import cricketBallLoaderAnimation from '../assets/animations/cricket-bat-ball-loader.json';

interface LoadingOverlayProps {
  label?: string;
}

// Full-screen loading state for the auth flow — the cricket bat & ball
// bounce animation stands in for a generic spinner while a sign-in request
// is in flight, matching the sports-tech premium direction (Lottie/vector
// loaders, not a plain ActivityIndicator).
export function LoadingOverlay({ label = 'Logging in...' }: LoadingOverlayProps) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 180 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
    >
      <View style={styles.backdrop}>
        <LottieView
          source={cricketBallLoaderAnimation}
          autoPlay
          loop
          style={styles.animation}
          resizeMode="contain"
        />
        <Text className="font-ui text-micro uppercase tracking-widest text-text-secondary mt-2">
          {label}
        </Text>
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  animation: {
    width: 220,
    height: 220,
  },
});
