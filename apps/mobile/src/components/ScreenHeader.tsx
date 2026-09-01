import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

interface ScreenHeaderProps {
  title: string;
}

// Fixed header per Design §3.2: "logo/back button left" — solid white,
// back chevron + screen title, used by every in-app secondary screen
// (Settings and its sub-screens).
export function ScreenHeader({ title }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View className="flex-row items-center py-4">
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="screen-header-back"
      >
        <Feather name="chevron-left" size={24} color="#0D0D0D" />
      </Pressable>
      <Text className="font-ui font-bold text-section-header text-ink-black ml-3">{title}</Text>
    </View>
  );
}
