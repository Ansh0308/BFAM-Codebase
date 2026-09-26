import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import cricketBallLoaderAnimation from '../assets/animations/cricket-bat-ball-loader.json';
import cricketBallLoaderAnimationLight from '../assets/animations/cricket-bat-ball-loader-white.json';

// The branded loading state — the cricket bat & ball animation the sign-in
// overlay uses (LoadingOverlay) — used for every loading indicator in the
// app, in place of the stock ActivityIndicator.
//   page   — a whole screen/list is loading
//   inline — one section of a screen is loading
//   small  — a tiny spot (inside a card or row)
//   button — replaces a button's label while it's busy; the box is oversized
//            (the animation has a lot of empty canvas) and pulled back with
//            negative margin so it doesn't grow the button
// tone="light" is the same animation in white, for solid-red / dark
// backgrounds where the default colours would disappear or clash.
const DIMENSION = { page: 180, inline: 120, small: 72, button: 60 } as const;

interface BallLoaderProps {
  size?: keyof typeof DIMENSION;
  tone?: 'default' | 'light';
  label?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Fill the parent and centre — for the app-launch / whole-screen case. */
  fill?: boolean;
}

export function BallLoader({
  size = 'page',
  tone = 'default',
  label,
  testID,
  style,
  fill,
}: BallLoaderProps) {
  const dimension = DIMENSION[size];
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      testID={testID}
      style={[
        { alignItems: 'center', justifyContent: 'center' },
        fill ? { flex: 1 } : null,
        size === 'button' ? { marginVertical: -20 } : null,
        style,
      ]}
    >
      {/* Fixed box: on web the Lottie element sizes itself to its parent
          (ignoring its own width/height), so the size has to live here. */}
      <View style={{ width: dimension, height: dimension }}>
        <LottieView
          source={tone === 'light' ? cricketBallLoaderAnimationLight : cricketBallLoaderAnimation}
          autoPlay
          loop
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </View>
      {label ? (
        <Text className="font-ui text-micro uppercase tracking-widest text-text-secondary mt-1">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
