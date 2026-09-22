import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Reveal } from './Reveal';
import loginHeroImage from '../assets/images/login-hero.jpg';

// Login's brand moment: a single pre-composited campaign photograph (BFAM
// wordmark, tagline, red diagonal geometry and the athlete all baked into
// one image) used as a full-width hero background, with only the "Welcome
// back" headline + copy rendered as real UI text on top of it. The form
// below stays on plain white, unchanged.
export function LoginHero() {
  const { height } = useWindowDimensions();
  const HERO_HEIGHT = Math.max(380, Math.min(480, height * 0.5));

  return (
    <View className="overflow-hidden" style={{ height: HERO_HEIGHT, marginHorizontal: -20 }}>
      {/* Rendered directly, not wrapped in Reveal — on web, the
          Reanimated-backed fade/rise timing animation can be interrupted
          mid-flight (e.g. a background/inactive tab during the very first
          paint) and never settle to its rest state, leaving this — the
          screen's whole brand moment — stuck nearly invisible at a low
          interpolated opacity. Too load-bearing to risk that; only the
          overlaid text below still gets the entrance treatment. */}
      <Image
        source={loginHeroImage}
        style={{ width: '100%', height: HERO_HEIGHT }}
        contentFit="cover"
        contentPosition="top"
        accessibilityRole="image"
        accessibilityLabel="BFAM batter walking onto the pitch, bat in hand, under floodlights"
      />

      <View style={{ position: 'absolute', top: HERO_HEIGHT * 0.33, left: 20 }}>
        <Reveal delay={120}>
          <Text className="font-display text-title-xl text-ink-black tracking-wide">
            Welcome back
          </Text>
          <View className="h-1 w-10 rounded-full bg-brand-red mt-2" />
          <Text className="font-ui text-body text-text-secondary mt-3">
            Log in and get back into the game.
          </Text>
        </Reveal>
      </View>
    </View>
  );
}
