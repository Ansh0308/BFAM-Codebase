import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ChipOption {
  value: string;
  label: string;
}

interface ChipSelectProps {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  testID?: string;
}

// Single-select chip row. Selected = brand-red bg/border per Design §7 —
// never a green/checkmark treatment for the active state.
export function ChipSelect({ label, options, value, onChange, testID }: ChipSelectProps) {
  return (
    <View className="mb-4" testID={testID}>
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        {label}
      </Text>
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              testID={`${testID ?? 'chip'}-${option.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={[
                'rounded-md border px-4 py-2 m-1',
                selected ? 'bg-brand-red border-brand-red' : 'bg-surface border-border-strong',
              ].join(' ')}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text
                className={[
                  'font-ui text-body',
                  selected ? 'text-white font-bold' : 'text-text-primary',
                ].join(' ')}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
