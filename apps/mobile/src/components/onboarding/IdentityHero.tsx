import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { Reveal } from '../Reveal';

const NUMBER_HEIGHT = 108;

// Screen 04 — IDENTITY. Identity-first: the BFAM ID number itself is the
// hero, treated like a jersey number rather than a profile card — a huge
// numeral with a thin red corner frame, revealed with a curtain-style mask
// (the number rises up from behind a clipped boundary) instead of a plain
// fade, mirroring a jersey being unveiled.
export function IdentityHero({ active }: { active: boolean }) {
  const [entered, setEntered] = useState(active);

  useEffect(() => {
    if (active) setEntered(true);
  }, [active]);

  return (
    <View className="items-center justify-center">
      <Reveal active={active} delay={20}>
        <Text className="font-display text-card-title text-ink-black tracking-wide">
          YOUR BFAM ID.
        </Text>
      </Reveal>

      <Reveal active={active} delay={60}>
        <Text className="font-ui text-micro font-bold uppercase tracking-widest text-brand-red mt-4">
          BF
        </Text>
      </Reveal>

      <View className="items-center justify-center" style={{ marginTop: 4 }}>
        <View style={{ height: NUMBER_HEIGHT, overflow: 'hidden' }}>
          <MotiView
            from={{ translateY: NUMBER_HEIGHT }}
            animate={{ translateY: entered ? 0 : NUMBER_HEIGHT }}
            transition={{ type: 'timing', duration: 480, delay: entered ? 90 : 0 }}
          >
            <Text
              className="font-display text-ink-black"
              style={{ fontSize: 104, lineHeight: NUMBER_HEIGHT }}
            >
              1007
            </Text>
          </MotiView>
        </View>

        {/* Thin red corner brackets framing the number, like a jersey
            number's stitched border — restrained, not a full box. */}
        <View
          pointerEvents="none"
          style={[frameCorner, { top: -6, left: -10, borderRightWidth: 0, borderBottomWidth: 0 }]}
        />
        <View
          pointerEvents="none"
          style={[frameCorner, { bottom: -6, right: -10, borderLeftWidth: 0, borderTopWidth: 0 }]}
        />
      </View>

      <Reveal active={active} delay={220}>
        <Text className="font-ui font-bold text-body text-ink-black uppercase tracking-wide mt-2">
          Viral R.
        </Text>
        <Text className="font-ui text-micro uppercase tracking-widest text-text-tertiary text-center mt-0.5">
          All Rounder
        </Text>
      </Reveal>

      <Reveal active={active} delay={270}>
        <View className="items-center mt-4">
          <Text className="font-display text-card-title text-brand-red">842</Text>
          <Text className="font-ui text-micro uppercase tracking-widest text-text-tertiary">
            BFAM Rating
          </Text>
        </View>
      </Reveal>
    </View>
  );
}

const frameCorner = {
  position: 'absolute' as const,
  width: 22,
  height: 22,
  borderColor: '#D80000',
  borderWidth: 3,
};
