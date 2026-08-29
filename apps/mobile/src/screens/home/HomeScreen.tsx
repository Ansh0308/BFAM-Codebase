import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../../navigation/types';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

// Placeholder Home screen — full Home (2.x) is out of this module's scope.
// Only the "Book Turf" quick action exists here, since module 2.3 is
// explicitly reachable from it.
export function HomeScreen({ navigation }: Props) {
  return (
    <View className="flex-1 bg-surface-alt px-6 pt-8">
      <Text className="font-display text-title-xl text-ink-black uppercase">Home</Text>
      <Text className="text-text-secondary text-body mt-2">
        The full Home screen is built in a later module.
      </Text>

      <Pressable
        onPress={() => navigation.navigate('Discover', { screen: 'TurfListing' })}
        className="bg-brand-red rounded-md py-4 items-center mt-8"
        testID="home-book-turf-quick-action"
      >
        <Text className="font-ui font-bold text-surface text-button uppercase">Book Turf</Text>
      </Pressable>
    </View>
  );
}
