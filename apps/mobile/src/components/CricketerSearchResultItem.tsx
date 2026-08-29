import React from 'react';
import { Pressable, Text, View, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Cricketer } from '@bfam/shared-types';

interface CricketerSearchResultItemProps {
  cricketer: Cricketer;
  onPress: () => void;
  testID?: string;
}

export function CricketerSearchResultItem({
  cricketer,
  onPress,
  testID,
}: CricketerSearchResultItemProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center py-3 border-b border-border-subtle"
      style={{ minHeight: 44 }}
    >
      {cricketer.photo_url ? (
        <Image
          source={{ uri: cricketer.photo_url }}
          className="rounded-full mr-4"
          style={{ width: 48, height: 48 }}
        />
      ) : (
        <View className="rounded-full mr-4 bg-disabled-surface" style={{ width: 48, height: 48 }} />
      )}
      <Text className="flex-1 font-ui font-bold text-body text-text-primary">{cricketer.name}</Text>
      <Feather name="chevron-right" size={20} color="#D80000" />
    </Pressable>
  );
}
