import React, { useRef, useState } from 'react';
import { Animated, View, Text, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { Reveal } from '../src/components/Reveal';
import { BookHero } from '../src/components/onboarding/BookHero';
import { PlayHero } from '../src/components/onboarding/PlayHero';
import { CompeteHero } from '../src/components/onboarding/CompeteHero';
import { IdentityHero } from '../src/components/onboarding/IdentityHero';
import { HAS_ONBOARDED_KEY } from './index';

// Four chapters of one premium BFAM campaign — each screen carries a
// single dominant visual idea (turf photo / player photo / scoreboard
// typography / jersey-number identity) rather than reusing one
// icon+headline+body template four times. Shared chrome (header, skip,
// progress, CTA) stays consistent; only the SLIDES metadata below and
// each Hero component's own layout differ per screen.
const SLIDE_KEYS = ['book', 'play', 'compete', 'identity'] as const;

// A paging dot that grows and fills in as its slide becomes active,
// driven by the same scroll-position value the slide content scrolls
// with — so the indicator tracks the actual swipe, not just the
// momentum-end index.
function PagingDot({
  index,
  scrollX,
  slideWidth,
}: {
  index: number;
  scrollX: Animated.Value;
  slideWidth: number;
}) {
  const inputRange = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
  const dotWidth = scrollX.interpolate({
    inputRange,
    outputRange: [8, 24, 8],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      className="h-2 rounded-full bg-brand-red mx-1"
      style={{ width: dotWidth, opacity }}
    />
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // `width` can be reported as 0 for the first render or two (notably on
  // web, before layout settles) — an unguarded `width - 40` then goes
  // negative, which flips PagingDot's inputRange backwards and crashes
  // Reanimated's interpolate ("inputRange must be monotonically
  // non-decreasing"). Floor it so the carousel never computes a
  // negative/zero slide width.
  const SLIDE_WIDTH = Math.max(width - 40, 1);
  const [slideIndex, setSlideIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  async function finishOnboarding() {
    // See app/index.tsx's getHasOnboarded() — SecureStore has no web
    // implementation, so this is a no-op there (web always re-onboards).
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(HAS_ONBOARDED_KEY, 'true');
    }
    router.replace('/login');
  }

  return (
    <ScreenContainer>
      {/* Very faint oversized wordmark behind the header/hero — same
          restrained watermark language as the auth screens, kept here at
          low opacity so it reads as texture, not decoration. */}
      <View style={{ position: 'absolute', top: -6, right: -12 }} pointerEvents="none">
        <Text
          className="font-display text-ink-black"
          style={{ fontSize: 90, opacity: 0.035, letterSpacing: -2 }}
        >
          BFAM
        </Text>
      </View>

      <Reveal delay={0}>
        <View className="flex-row items-start justify-between pt-4 mb-1">
          <View>
            <Text className="font-display text-card-title text-brand-red">BFAM</Text>
            <Text className="font-ui text-micro uppercase tracking-widest text-text-tertiary mt-0.5">
              Play. Compete. Repeat.
            </Text>
          </View>
          <Button label="Skip" variant="secondary" fullWidth={false} onPress={finishOnboarding} />
        </View>
      </Reveal>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          // Divided by the slide's own width (width - 40, matching the
          // ScreenContainer's horizontal padding) rather than the full
          // screen width, since that's the actual paging increment.
          const index = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
          setSlideIndex(index);
        }}
        className="flex-1"
      >
        <View style={{ width: SLIDE_WIDTH, overflow: 'hidden' }} className="justify-center">
          <BookHero />
        </View>
        <View style={{ width: SLIDE_WIDTH, overflow: 'hidden' }} className="justify-center">
          <PlayHero active={slideIndex === 1} />
        </View>
        <View style={{ width: SLIDE_WIDTH, overflow: 'hidden' }} className="justify-center">
          <CompeteHero active={slideIndex === 2} />
        </View>
        <View style={{ width: SLIDE_WIDTH, overflow: 'hidden' }} className="justify-center">
          <IdentityHero active={slideIndex === 3} />
        </View>
      </Animated.ScrollView>

      <Reveal delay={260}>
        <View className="items-center mb-6">
          <View className="flex-row justify-center items-center" testID="onboarding-dots">
            {SLIDE_KEYS.map((key, index) => (
              <PagingDot key={key} index={index} scrollX={scrollX} slideWidth={SLIDE_WIDTH} />
            ))}
          </View>
          <Text className="font-ui text-micro tracking-widest text-text-tertiary mt-2">
            {String(slideIndex + 1).padStart(2, '0')} / {String(SLIDE_KEYS.length).padStart(2, '0')}
          </Text>
        </View>
      </Reveal>

      <Reveal delay={300}>
        <View className="mb-6">
          <Button
            label={slideIndex === SLIDE_KEYS.length - 1 ? 'Get Started' : 'Next'}
            onPress={() => {
              if (slideIndex === SLIDE_KEYS.length - 1) {
                finishOnboarding();
                return;
              }
              // Fix (found while refreshing this screen for D-2): tapping
              // Next only ever updated slideIndex — the carousel itself
              // never actually moved unless the user swiped it, so the
              // title/body/dots silently fell out of sync with the button's
              // own label. Now scrolls the ScrollView to match.
              const nextIndex = Math.min(slideIndex + 1, SLIDE_KEYS.length - 1);
              scrollRef.current?.scrollTo({ x: nextIndex * SLIDE_WIDTH, animated: true });
              setSlideIndex(nextIndex);
            }}
            testID="onboarding-next-button"
            iconRight={<Feather name="arrow-right" size={18} color="#FFFFFF" />}
          />
        </View>
      </Reveal>
    </ScreenContainer>
  );
}
