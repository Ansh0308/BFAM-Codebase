import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Reveal } from '../Reveal';
import onboardingBattingImage from '../../assets/images/onboarding-batting.jpg';

const BALLS: { label: string; boundary?: boolean; wicket?: boolean }[] = [
  { label: '1' },
  { label: '0' },
  { label: '4', boundary: true },
  { label: '1' },
  { label: '6', boundary: true },
  { label: 'W', wicket: true },
];

const FEATURES: { icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { icon: 'bar-chart-2', label: 'Live Scores' },
  { icon: 'users', label: 'Match Updates' },
  { icon: 'award', label: 'Team Stats' },
];

// Screen 03 — COMPETE. Typography/broadcast-first: a sports-broadcast
// scoreboard card is the centerpiece, paired with a cropped batting-action
// photo bleeding off the top-right — a completely different composition
// from Screen 1 (centered photo) and Screen 2 (asymmetric split).
export function CompeteHero({ active }: { active: boolean }) {
  const { height } = useWindowDimensions();
  const TOP_HEIGHT = Math.max(230, Math.min(300, height * 0.32));
  const [score, setScore] = useState('82 / 6');
  const hasFlipped = useRef(false);

  useEffect(() => {
    if (active && !hasFlipped.current) {
      hasFlipped.current = true;
      const t = setTimeout(() => setScore('86 / 4'), 550);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <View className="justify-center">
      <View className="flex-row" style={{ height: TOP_HEIGHT }}>
        <View style={{ flex: 0.6, paddingRight: 10, justifyContent: 'flex-start' }}>
          <Reveal active={active} delay={20}>
            <View className="flex-row items-center self-start rounded-full border border-brand-red bg-surface px-3 py-1">
              <PulsingDot />
              <Text className="font-ui text-micro font-bold uppercase tracking-widest text-brand-red ml-2">
                Live
              </Text>
            </View>
          </Reveal>

          <Reveal active={active} delay={70}>
            <Text
              className="font-display text-ink-black mt-3"
              style={{ fontSize: 34, lineHeight: 36 }}
            >
              <Text>PLAY.</Text>
              {'\n'}
              <Text className="text-brand-red">COMPETE.</Text>
              {'\n'}
              <Text>REPEAT.</Text>
            </Text>
            <View className="h-0.5 w-8 bg-brand-red mt-2" />
          </Reveal>

          <Reveal active={active} delay={120}>
            <Text className="font-ui text-body text-text-secondary mt-3">
              Join matches. Follow every run. Own the game.
            </Text>
          </Reveal>
        </View>

        <Reveal active={active} direction="right" distance={20} delay={40} style={{ flex: 0.46 }}>
          <View className="overflow-hidden" style={{ flex: 1 }}>
            <Image
              source={onboardingBattingImage}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel="BFAM batter playing a shot under floodlights"
            />
          </View>
          <Text
            className="font-ui text-micro font-bold uppercase text-white"
            style={{
              position: 'absolute',
              top: 10,
              right: 4,
              textAlign: 'right',
              lineHeight: 13,
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            More{'\n'}than{'\n'}a game
          </Text>
        </Reveal>
      </View>

      <Reveal active={active} delay={160}>
        <View className="rounded-lg overflow-hidden mt-4" style={{ backgroundColor: '#0D0D0D' }}>
          <View className="flex-row">
            <View className="bg-brand-red px-4 py-3" style={{ flex: 1 }}>
              <Text className="font-ui text-micro font-bold uppercase tracking-wide text-white">
                BFAM Warriors
              </Text>
              <MotiView
                key={score}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 220 }}
              >
                <Text className="font-display text-white" style={{ fontSize: 38, lineHeight: 40 }}>
                  {score}
                </Text>
              </MotiView>
              <Text
                className="font-ui text-micro uppercase tracking-wide text-white"
                style={{ opacity: 0.85 }}
              >
                8.2 Overs
              </Text>
            </View>

            <View
              className="items-center justify-center bg-ink-black rounded-full"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 34,
                height: 34,
                marginLeft: -17,
                marginTop: -17,
              }}
            >
              <Text className="font-ui text-micro font-bold text-white">VS</Text>
            </View>

            <View className="px-4 py-3" style={{ flex: 1 }}>
              <Text className="font-ui text-micro font-bold uppercase tracking-wide text-white text-right">
                BFAM Strikers
              </Text>
              <Text
                className="font-display text-white text-right"
                style={{ fontSize: 38, lineHeight: 40 }}
              >
                82 / 6
              </Text>
              <Text
                className="font-ui text-micro uppercase tracking-wide text-white text-right"
                style={{ opacity: 0.6 }}
              >
                8.2 Overs
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#D80000' }} />

          <View className="flex-row items-center px-4 py-3">
            <Text
              className="font-ui text-micro uppercase tracking-widest text-white"
              style={{ opacity: 0.6 }}
            >
              Last 6 balls
            </Text>
            <View className="flex-row ml-auto">
              {BALLS.map((ball, i) => (
                <View
                  key={i}
                  className={ball.boundary || ball.wicket ? 'bg-brand-red' : ''}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 5,
                    backgroundColor: ball.boundary || ball.wicket ? undefined : '#2A2A2A',
                  }}
                >
                  <Text className="font-ui text-white" style={{ fontSize: 10, fontWeight: '700' }}>
                    {ball.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Reveal>

      <Reveal active={active} delay={210}>
        <View className="flex-row items-center justify-between mt-4 px-2">
          {FEATURES.map((f, i) => (
            <React.Fragment key={f.label}>
              {i > 0 ? <View style={{ width: 1, height: 28, backgroundColor: '#E0E0E0' }} /> : null}
              <View className="items-center" style={{ flex: 1 }}>
                <Feather name={f.icon} size={18} color="#0D0D0D" />
                <Text className="font-ui text-micro uppercase tracking-wide text-text-tertiary mt-1 text-center">
                  {f.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Reveal>
    </View>
  );
}

// A small looping opacity pulse on the "Live" dot — the one continuously
// animating element on this screen, kept subtle (no scale/size change).
function PulsingDot() {
  return (
    <MotiView
      from={{ opacity: 0.35 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
      style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D80000' }}
    />
  );
}
