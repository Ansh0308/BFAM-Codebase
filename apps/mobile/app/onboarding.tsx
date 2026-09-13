import React, { useRef, useState } from 'react';
import { Animated, View, Text, ScrollView, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { HAS_ONBOARDED_KEY } from './index';

// Backlog D-2: visual refresh of the 3 Get Started screens — a large icon
// badge per slide (matching the circular-badge language RoleCard already
// uses elsewhere), a red accent divider under the title, and an animated
// paging indicator, in place of the previous plain-text-only layout.
const SLIDES: { title: string; body: string; icon: keyof typeof Feather.glyphMap }[] = [
  {
    title: 'BOOK TURFS INSTANTLY',
    body: 'Find and book cricket turfs near you in seconds.',
    icon: 'map-pin',
  },
  {
    title: 'LIVE SCORING',
    body: 'Score every ball and share it live with your team.',
    icon: 'activity',
  },
  {
    title: 'YOUR BFAM ID',
    body: 'A permanent identity across every match you play.',
    icon: 'award',
  },
];

const { width } = Dimensions.get('window');

// A paging dot that grows and fills in as its slide becomes active,
// driven by the same scroll-position value the slide content scrolls
// with — so the indicator tracks the actual swipe, not just the
// momentum-end index.
function PagingDot({ index, scrollX }: { index: number; scrollX: Animated.Value }) {
  const slideWidth = width - 40;
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
      <View className="flex-row justify-end pt-4">
        <Button label="Skip" variant="secondary" fullWidth={false} onPress={finishOnboarding} />
      </View>

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
          const index = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
          setSlideIndex(index);
        }}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.title}
            style={{ width: width - 40 }}
            className="items-center justify-center"
          >
            <View
              className="rounded-full bg-surface-alt items-center justify-center mb-8"
              style={{ width: 128, height: 128 }}
            >
              <Feather name={slide.icon} size={56} color="#D80000" />
            </View>
            <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
              {slide.title}
            </Text>
            <View className="h-0.5 w-10 bg-brand-red my-3" />
            <Text className="font-ui text-body text-text-secondary text-center px-4">
              {slide.body}
            </Text>
          </View>
        ))}
      </Animated.ScrollView>

      <View className="flex-row justify-center items-center mb-6" testID="onboarding-dots">
        {SLIDES.map((slide, index) => (
          <PagingDot key={slide.title} index={index} scrollX={scrollX} />
        ))}
      </View>

      <View className="mb-6">
        <Button
          label={slideIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={() => {
            if (slideIndex === SLIDES.length - 1) {
              finishOnboarding();
              return;
            }
            // Fix (found while refreshing this screen for D-2): tapping
            // Next only ever updated slideIndex — the carousel itself
            // never actually moved unless the user swiped it, so the
            // title/body/dots silently fell out of sync with the button's
            // own label. Now scrolls the ScrollView to match.
            const nextIndex = Math.min(slideIndex + 1, SLIDES.length - 1);
            scrollRef.current?.scrollTo({ x: nextIndex * (width - 40), animated: true });
            setSlideIndex(nextIndex);
          }}
          testID="onboarding-next-button"
        />
      </View>
    </ScreenContainer>
  );
}
