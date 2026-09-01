import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';

// Deliberate stub — module 2.6 (Match Creation & Game Room) owns the real
// Create Game flow. Team Details only hands off here.
export default function CreateMatchStubScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center" testID="create-match-stub-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
          Create Match
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-3">
          Match Creation & Game Room is built in module 2.6.
        </Text>
        <View className="mt-8 w-full">
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}
