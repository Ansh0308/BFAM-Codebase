import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Button } from '../../../src/components/Button';

// Team Details hands off here rather than needing its own booking context
// — Create Game (module 2.6) always starts from a confirmed booking, so
// this screen just routes the captain to book a turf (or straight to
// Create Game once module 2.3's flow gives them a bookingId).
export default function CreateMatchStubScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center" testID="create-match-stub-screen">
        <Text className="font-ui font-bold text-title-xl text-ink-black text-center">
          Ready to Play?
        </Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-3">
          A match is created against a confirmed turf booking. Book a turf first, then create the
          match from its confirmation screen — or from the Matches tab.
        </Text>
        <View className="mt-8 w-full">
          <Button label="Book a Turf" onPress={() => router.push('/(tabs)/discover')} />
        </View>
        <View className="mt-3 w-full">
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}
