import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Reveal } from './Reveal';
import signupHeroImage from '../assets/images/signup-hero.jpg';

// Signup's brand moment: a single pre-composited campaign photograph
// (BFAM wordmark, tagline, watermark, red diagonal geometry, athlete and
// campaign captions all baked into one image — same technique as Login's
// hero) used as a full-width top hero. "Join the game / Create your account"
// is real UI text, set on the plain white area BELOW the photo: it used to be
// laid over the picture, where it collided with the athlete and the photo's own
// captions on some screen sizes.
export function SignupHero() {
  const { height } = useWindowDimensions();
  const HERO_HEIGHT = Math.max(340, Math.min(460, height * 0.46));

  return (
    <View>
      <View className="overflow-hidden" style={{ height: HERO_HEIGHT, marginHorizontal: -20 }}>
        {/* Rendered directly, not wrapped in Reveal — see LoginHero for why:
            the entrance animation can get interrupted mid-flight on web and
            never settle, leaving the hero photo stuck at a low opacity. */}
        <Image
          source={signupHeroImage}
          style={{ width: '100%', height: HERO_HEIGHT }}
          contentFit="cover"
          contentPosition="top"
          accessibilityRole="image"
          accessibilityLabel="BFAM batter walking onto the pitch, bat raised, under a stormy floodlit sky"
        />
      </View>

      <View style={{ marginTop: 18, marginBottom: 6 }} testID="signup-headline">
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
