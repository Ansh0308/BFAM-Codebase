import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Reveal } from '../Reveal';

const HERO_HEIGHT = 250;

// "READY TO PLAY?" — headline, supporting line and the primary CTA. There is
// no card and no image of its own: the batter is the Home screen's full-bleed
// background artwork, and this block simply sits over the pale stadium haze
// on its left. The CTA scales in (0.96 -> 1) and gives press feedback.
export function HomeHero({ onFindMatch }: { onFindMatch: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={{ height: HERO_HEIGHT, marginTop: 8 }} testID="home-hero">
      <Reveal delay={140}>
        <Text
          className="font-display text-ink-black"
          style={{ fontSize: 44, lineHeight: 46, transform: [{ skewX: '-8deg' }] }}
        >
          READY
        </Text>
        <Text
          className="font-display text-brand-red"
          style={{ fontSize: 44, lineHeight: 46, transform: [{ skewX: '-8deg' }] }}
        >
          TO PLAY?
        </Text>
        <View className="bg-brand-red" style={{ height: 3, width: 48, marginTop: 10 }} />
      </Reveal>
      <Reveal delay={260}>
        <Text
          className="font-ui text-text-secondary"
          style={{ fontSize: 14, lineHeight: 20, marginTop: 12, maxWidth: '40%' }}
        >
          Find your turf. Build your team. Own the moment.
        </Text>
      </Reveal>

      <MotiView
        from={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: pressed ? 0.98 : 1, opacity: 1 }}
        transition={{ type: 'timing', duration: pressed ? 90 : 320, delay: pressed ? 0 : 380 }}
        style={{ position: 'absolute', left: 0, bottom: 4 }}
      >
        <Pressable
          onPress={onFindMatch}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          testID="home-find-match-button"
          accessibilityRole="button"
          accessibilityLabel="Find a match"
          className="flex-row items-center bg-brand-red"
          style={{ height: 48, paddingHorizontal: 22, borderRadius: 10 }}
        >
          <Text
            className="font-ui font-bold text-white"
            style={{ fontSize: 14, letterSpacing: 1.2 }}
          >
            FIND A MATCH
          </Text>
          <Feather name="arrow-right" size={17} color="#FFFFFF" style={{ marginLeft: 10 }} />
        </Pressable>
      </MotiView>
    </View>
  );
}
