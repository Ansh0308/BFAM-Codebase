import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenContainer } from './ScreenContainer';

interface ComingSoonScreenProps {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  note?: string;
}

// Stub landing content for a tab bar entry whose real screen belongs to a
// later module (Home → 2.x, Discover → 2.3, Matches → 2.x, Teams → 2.x).
// Module 2.2 only needs these to exist as real, navigable tab destinations
// — not the actual feature — per its brief: "only stub the nav entry
// points this module hands off to."
export function ComingSoonScreen({ title, icon, note }: ComingSoonScreenProps) {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center">
        <View
          className="rounded-full bg-surface-alt items-center justify-center mb-4"
          style={{ width: 72, height: 72 }}
        >
          <Feather name={icon} size={32} color="#D80000" />
        </View>
        <Text className="font-display text-title-xl uppercase text-ink-black">{title}</Text>
        <Text className="font-ui text-body text-text-tertiary text-center mt-2 px-5">
          {note ?? 'Coming soon.'}
        </Text>
      </View>
    </ScreenContainer>
  );
}
