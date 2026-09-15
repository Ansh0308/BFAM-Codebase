import React from 'react';
import { View, Text, Image, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Reveal } from '../Reveal';
import onboardingPlayersImage from '../../assets/images/onboarding-players.jpg';

const STRIPE_WIDTH = 46;

// Screen 02 — PLAY. People-first: a dynamic asymmetric split — big
// headline + copy on the left, a full-bleed editorial player photo on the
// right, separated by a red diagonal "flag" seam instead of a straight
// divider. Deliberately not a repeat of Screen 1's centered photo stack.
export function PlayHero({ active }: { active: boolean }) {
  const { height } = useWindowDimensions();
  const PANEL_HEIGHT = Math.max(400, Math.min(560, height * 0.58));

  return (
    <View className="flex-row" style={{ height: PANEL_HEIGHT }}>
      <View style={{ flex: 0.44, paddingRight: 6, justifyContent: 'space-between' }}>
        <View>
          <Reveal active={active} direction="left" distance={18} delay={40}>
            <Text className="font-display text-ink-black" style={{ fontSize: 40, lineHeight: 42 }}>
              <Text>FIND</Text>
              {'\n'}
              <Text>YOUR</Text>
              {'\n'}
              <Text className="text-brand-red">PLAYERS.</Text>
            </Text>
            <View className="h-0.5 w-8 bg-brand-red mt-2" />
          </Reveal>

          <Reveal active={active} direction="left" distance={18} delay={110}>
            <Text className="font-ui text-body text-text-secondary mt-4">
              Meet players. Build your team. Play together.
            </Text>
          </Reveal>
        </View>

        <Reveal active={active} direction="left" distance={18} delay={170}>
          <View className="h-0.5 w-6 bg-brand-red mb-2" />
          <Text
            className="font-ui text-micro uppercase tracking-widest text-text-tertiary"
            style={{ lineHeight: 16 }}
          >
            Play{'\n'}Compete{'\n'}Belong
          </Text>
        </Reveal>
      </View>

      <View style={{ width: STRIPE_WIDTH }}>
        <Svg
          width={STRIPE_WIDTH}
          height={PANEL_HEIGHT}
          viewBox={`0 0 ${STRIPE_WIDTH} ${PANEL_HEIGHT}`}
        >
          <Polygon
            points={`${STRIPE_WIDTH * 0.55},0 ${STRIPE_WIDTH},0 ${STRIPE_WIDTH * 0.15},${PANEL_HEIGHT} 0,${PANEL_HEIGHT}`}
            fill="#D80000"
          />
        </Svg>
      </View>

      <Reveal
        active={active}
        direction="right"
        distance={22}
        delay={40}
        duration={320}
        style={{ flex: 1 }}
      >
        <View className="overflow-hidden" style={{ flex: 1 }}>
          <Image
            source={onboardingPlayersImage}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel="BFAM teammates fist-bumping courtside"
          />
        </View>
      </Reveal>
    </View>
  );
}
