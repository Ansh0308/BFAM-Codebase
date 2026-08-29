import React from 'react';
import { Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';

// Shared placeholder for tabs not yet built (Matches, Teams, Profile are
// separate modules). Keeps the bottom tab bar navigable end-to-end without
// pretending to implement those modules here.
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-title-xl text-ink-black uppercase">{title}</Text>
        <Text className="font-ui text-body text-text-secondary text-center mt-2">
          Built in a later module.
        </Text>
      </View>
    </ScreenContainer>
  );
}
