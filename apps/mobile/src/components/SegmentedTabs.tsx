import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testIDPrefix: string;
}

// A pill-style segmented control — same visual language as Open Teams'
// Players/Challenge switch (backlog B-13), pulled out into a shared
// component so every Upcoming/Past-style split (My Bookings, My Matches,
// backlog A-15) looks and behaves identically instead of each screen
// reinventing its own toggle.
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: SegmentedTabsProps<T>) {
  return (
    <View className="flex-row bg-surface-alt rounded-md p-1 mb-4">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center py-2 rounded-md ${selected ? 'bg-brand-red' : ''}`}
            testID={`${testIDPrefix}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text
              className={`font-ui font-bold text-micro uppercase ${
                selected ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
