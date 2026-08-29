import React from 'react';
import { Text, View } from 'react-native';

// Shared placeholder for tabs not yet built (Matches, Teams, Profile are
// separate modules). Keeps the bottom tab bar navigable end-to-end without
// pretending to implement those modules here.
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View className="flex-1 bg-surface-alt items-center justify-center px-6">
      <Text className="font-display text-title-xl text-ink-black uppercase">{title}</Text>
      <Text className="text-text-secondary text-body text-center mt-2">
        Built in a later module.
      </Text>
    </View>
  );
}
