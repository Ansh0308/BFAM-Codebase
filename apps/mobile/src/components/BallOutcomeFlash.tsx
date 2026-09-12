import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../theme/tokens';

export type BallOutcome = 'FOUR' | 'SIX' | 'WICKET' | null;

const OUTCOME_META: Record<Exclude<BallOutcome, null>, { label: string; color: string }> = {
  FOUR: { label: 'FOUR!', color: colors.brandRed },
  SIX: { label: 'SIX!', color: colors.brandRed },
  WICKET: { label: 'OUT!', color: colors.inkBlack },
};

// A brief, full-width celebratory overlay for a boundary or wicket — the
// scoring interface's answer to a TV broadcast's "SIX!" graphic. Purely
// decorative (doesn't block input — pointerEvents="none"), and
// self-clears via onDone so the caller only has to set outcome once per
// ball and not worry about resetting it.
export function BallOutcomeFlash({
  outcome,
  onDone,
}: {
  outcome: BallOutcome;
  onDone: () => void;
}) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!outcome) return;
    scale.value = 0.6;
    opacity.value = 0;
    scale.value = withSequence(
      withTiming(1.15, { duration: 260, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 120 }),
      withDelay(500, withTiming(1.3, { duration: 260, easing: Easing.in(Easing.exp) })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(
        600,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(onDone)();
        }),
      ),
    );
    // Only `outcome` should retrigger this: `onDone` is a fresh inline
    // closure from the caller every render but always does the same thing
    // (clears the outcome), and scale/opacity are stable shared-value refs
    // — depending on either would restart the animation on unrelated
    // parent re-renders instead of only on a new outcome.
  }, [outcome]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!outcome) return null;

  const meta = OUTCOME_META[outcome];
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}
      testID={`ball-outcome-flash-${outcome}`}
    >
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  text: {
    fontFamily: 'Anton',
    fontSize: 64,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
