import React, { useState } from 'react';
import { View, Text, ScrollView, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Button } from '../src/components/Button';
import { HAS_ONBOARDED_KEY } from './index';

const SLIDES = [
  {
    title: 'BOOK TURFS INSTANTLY',
    body: 'Find and book cricket turfs near you in seconds.',
  },
  {
    title: 'LIVE SCORING',
    body: 'Score every ball and share it live with your team.',
  },
  {
    title: 'YOUR BFAM ID',
    body: 'A permanent identity across every match you play.',
  },
];

const { width } = Dimensions.get('window');

export default function Onboarding() {
  const router = useRouter();
  const [slideIndex, setSlideIndex] = useState(0);

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

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setSlideIndex(index);
        }}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={{ width: width - 40 }} className="justify-center">
            <Text className="font-ui font-bold text-title-xl text-ink-black mb-4">
              {slide.title}
            </Text>
            <Text className="font-ui text-body text-text-secondary">{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-center mb-6">
        {SLIDES.map((slide, index) => (
          <View
            key={slide.title}
            className={[
              'w-2 h-2 rounded-full mx-1',
              index === slideIndex ? 'bg-brand-red' : 'bg-border-strong',
            ].join(' ')}
          />
        ))}
      </View>

      <View className="mb-6">
        <Button
          label={slideIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={() => {
            if (slideIndex === SLIDES.length - 1) {
              finishOnboarding();
            } else {
              setSlideIndex((i) => Math.min(i + 1, SLIDES.length - 1));
            }
          }}
        />
      </View>
    </ScreenContainer>
  );
}
