import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../../src/components/ScreenContainer';
import { Button } from '../../../../src/components/Button';

// Deliberate stub — module 2.10 (Statistics) owns the real player/team
// stats screens. Match Result hands off here.
export default function StatsStubScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center" testID="stats-stub-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
          Statistics
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-3">
          Player and team statistics are built in module 2.10.
        </Text>
        <View className="mt-8 w-full">
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}
