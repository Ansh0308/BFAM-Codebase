import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';

// Placeholder Home tab — the full Home screen is a later module. Only the
// "Book Turf" quick action exists here, since module 2.3 (Turf Discovery &
// Booking) is explicitly reachable from it.
export default function Home() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="pt-6">
        <Text className="font-display text-title-xl text-ink-black uppercase">Home</Text>
        <Text className="font-ui text-body text-text-secondary mt-2">
          The full Home screen is built in a later module.
        </Text>

        <View className="mt-8">
          <Button
            label="Book Turf"
            onPress={() => router.push('/(tabs)/discover')}
            testID="home-book-turf-quick-action"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
