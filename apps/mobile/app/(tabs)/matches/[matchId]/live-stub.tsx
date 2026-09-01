import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';

// Deliberate stub — module 2.8 (Live Scoring) owns the real scoring
// interface. The Countdown Intro (module 2.7) hands off here.
export default function LiveScoringStubScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center" testID="live-scoring-stub-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
          Match Live
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-3">
          Live Scoring is built in module 2.8.
        </Text>
        <View className="mt-8 w-full">
          <Button label="Back to Game Room" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}
