import React from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { CricketBallIcon } from './CricketBallIcon';

interface AuthScreenBackgroundProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** Wraps content in a KeyboardAvoidingView so a focused field / the
   * primary CTA never ends up hidden behind the keyboard. Opt-in per
   * screen since not every auth screen has inputs near the bottom. */
  avoidKeyboard?: boolean;
  /** Adds a large, very faint, slowly-spinning cricket ball behind the
   * form — an ambient sports-tech touch, opt-in so it doesn't change the
   * look of every screen that shares this shell. */
  showBallMotif?: boolean;
}

// Shared decorative shell for the auth/onboarding flow (Login, Signup, etc.)
// — the diagonal brand-red geometric shapes and the oversized faint "BFAM"
// wordmark watermark are Design §5's recurring signature motif ("diagonal
// geometric red shapes... a recurring signature motif, not a one-off").
// Drop-in replacement for ScreenContainer on these screens: same
// safe-area/scroll/px-5 behavior, plus the decoration layered behind it.
export function AuthScreenBackground({
  children,
  scroll = false,
  avoidKeyboard = false,
  showBallMotif = false,
}: AuthScreenBackgroundProps) {
  const Wrapper = scroll ? ScrollView : View;

  const content = (
    <Wrapper className="flex-1 px-5" contentContainerStyle={scroll ? { flexGrow: 1 } : undefined}>
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 320 }}
        style={{ flex: scroll ? undefined : 1 }}
      >
        {children}
      </MotiView>
    </Wrapper>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Text className="font-display text-ink-black" style={styles.watermarkText}>
          BFAM
        </Text>
      </View>

      <View
        className="bg-brand-red"
        style={[styles.shape, styles.shapeTopRight]}
        pointerEvents="none"
      />
      <View
        className="bg-brand-red"
        style={[styles.shape, styles.shapeBottomLeftA]}
        pointerEvents="none"
      />
      <View
        className="bg-brand-red"
        style={[styles.shape, styles.shapeBottomLeftB]}
        pointerEvents="none"
      />

      {showBallMotif ? (
        <View style={styles.ballWrap} pointerEvents="none">
          <MotiView
            from={{ rotate: '0deg' }}
            animate={{ rotate: '360deg' }}
            transition={{
              type: 'timing',
              duration: 14000,
              easing: Easing.linear,
              loop: true,
              repeatReverse: false,
            }}
          >
            <CricketBallIcon size={220} color="#0D0D0D" strokeWidth={1.5} showStitches />
          </MotiView>
        </View>
      ) : null}

      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  watermarkWrap: {
    position: 'absolute',
    top: -8,
    left: -6,
  },
  watermarkText: {
    fontSize: 96,
    opacity: 0.04,
    letterSpacing: -2,
  },
  ballWrap: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    opacity: 0.05,
  },
  shape: {
    position: 'absolute',
  },
  shapeTopRight: {
    top: -40,
    right: -50,
    width: 90,
    height: 220,
    transform: [{ rotate: '25deg' }],
  },
  shapeBottomLeftA: {
    bottom: -70,
    left: -80,
    width: 90,
    height: 160,
    transform: [{ rotate: '25deg' }],
  },
  shapeBottomLeftB: {
    bottom: -50,
    left: -10,
    width: 34,
    height: 90,
    transform: [{ rotate: '25deg' }],
  },
});
