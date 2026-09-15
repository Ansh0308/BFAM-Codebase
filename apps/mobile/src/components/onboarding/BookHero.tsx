import React from 'react';
import { View, Text, Image, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Reveal } from '../Reveal';
import onboardingHeroImage from '../../assets/images/onboarding-hero.jpg';

// Screen 01 — BOOK. Photography-first: the turf/arena is the dominant
// visual idea, everything else (location chip, headline, copy) supports it.
export function BookHero() {
  const { height } = useWindowDimensions();
  // Clamp rather than a flat percentage so small phones don't lose the CTA
  // below the fold and large phones don't get an oversized, empty-feeling
  // hero (Design brief: responsive, not just "bigger on bigger screens").
  const HERO_HEIGHT = Math.max(200, Math.min(300, height * 0.38));

  return (
    <View className="justify-center">
      <Reveal delay={80}>
        <View className="rounded-lg overflow-hidden" style={{ height: HERO_HEIGHT }}>
          <Image
            source={onboardingHeroImage}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel="BFAM indoor box-cricket turf at dusk"
          />
          <View
            className="bg-brand-red"
            style={{
              position: 'absolute',
              bottom: -18,
              left: -18,
              width: 70,
              height: 70,
              transform: [{ rotate: '25deg' }],
            }}
            pointerEvents="none"
          />
        </View>
      </Reveal>

      <Reveal delay={140}>
        <View className="flex-row items-center mt-5 mb-2">
          <View className="w-6 h-6 rounded-full bg-brand-red items-center justify-center mr-2">
            <Feather name="map-pin" size={12} color="#FFFFFF" />
          </View>
          <Text className="font-ui text-micro uppercase tracking-widest text-text-secondary">
            Near you
          </Text>
        </View>
      </Reveal>

      <Reveal delay={180}>
        <Text className="font-display text-title-xl text-ink-black" style={{ lineHeight: 40 }}>
          <Text>BOOK TURFS</Text>
          {'\n'}
          <Text className="text-brand-red">INSTANTLY</Text>
        </Text>
      </Reveal>

      <Reveal delay={220}>
        <Text className="font-ui text-body text-text-secondary mt-3">
          Find your turf. Pick a slot. Start playing.
        </Text>
      </Reveal>
    </View>
  );
}
