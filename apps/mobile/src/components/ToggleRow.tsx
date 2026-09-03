import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

// A labeled on/off row with a custom brand-red track + white thumb toggle.
// Not the native RN Switch: react-native-web's Switch hardcodes its "on"
// thumb to Material teal (#009688) regardless of the thumbColor prop, which
// would violate Design §7 (brand-red only — never green — for an "on"/
// positive state). This custom control renders identically on native and
// web.
export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
  testID,
}: ToggleRowProps) {
  return (
    <View
      className="flex-row items-center justify-between py-4 border-b border-border-subtle"
      testID={testID}
    >
      <View className="flex-1 pr-4">
        <Text className="font-ui text-body text-text-primary">{label}</Text>
        {description ? (
          <Text className="font-ui text-micro text-text-tertiary mt-1">{description}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onValueChange(!value)}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        testID={testID ? `${testID}-switch` : undefined}
        hitSlop={8}
        className={value ? 'bg-brand-red' : 'bg-border-strong'}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          padding: 2,
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View className="bg-white" style={{ width: 22, height: 22, borderRadius: 11 }} />
      </Pressable>
    </View>
  );
}
