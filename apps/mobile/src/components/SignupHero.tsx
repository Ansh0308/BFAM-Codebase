import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Reveal } from './Reveal';
import signupHeroImage from '../assets/images/signup-hero.jpg';

// Signup's brand moment: a single pre-composited campaign photograph
// (BFAM wordmark, tagline, watermark, red diagonal geometry, athlete and
// campaign captions all baked into one image — same technique as Login's
// hero) used as a full-width top hero, with only "Join the game / Create
// your account" rendered as real UI text on top of it. The form below
// stays on plain white, unchanged.
export function SignupHero() {
  const { height } = useWindowDimensions();
  const HERO_HEIGHT = Math.max(460, Math.min(600, height * 0.62));

  return (
    <View className="overflow-hidden" style={{ height: HERO_HEIGHT, marginHorizontal: -20 }}>
      <Reveal duration={340}>
        <Image
          source={signupHeroImage}
          style={{ width: '100%', height: HERO_HEIGHT }}
          contentFit="cover"
          contentPosition="top"
          accessibilityRole="image"
          accessibilityLabel="BFAM batter walking onto the pitch, bat raised, under a stormy floodlit sky"
        />
      </Reveal>

      {/* Soft scrim behind the headline block only — the photo's brightness
          varies underneath it (foggy sky vs. stadium seating), so contrast
          can't be guaranteed by placement alone. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: HERO_HEIGHT * 0.46,
          left: 0,
          right: 0,
          height: HERO_HEIGHT * 0.34,
        }}
        pointerEvents="none"
      />

      <View style={{ position: 'absolute', top: HERO_HEIGHT * 0.5, left: 20 }}>
        <Reveal delay={120}>
          <View className="flex-row items-center mb-2">
            <View className="h-0.5 w-4 bg-brand-red mr-2" />
            <Text className="font-ui text-micro font-bold uppercase tracking-widest text-text-secondary">
              Join the game
            </Text>
          </View>
          <Text className="font-display text-title-xl text-ink-black" style={{ lineHeight: 40 }}>
            <Text>CREATE</Text>
            {'\n'}
            <Text className="text-brand-red">YOUR ACCOUNT</Text>
          </Text>
          <View className="h-1 w-10 rounded-full bg-brand-red mt-2" />
          <Text className="font-ui text-body text-text-secondary mt-3">Play. Compete. Belong.</Text>
        </Reveal>
      </View>
    </View>
  );
}
