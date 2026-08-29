import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /** e.g. a person/lock icon rendered inside the field, left-aligned. */
  iconLeft?: React.ReactNode;
  /** e.g. a password show/hide toggle, right-aligned inside the field. */
  rightAction?: React.ReactNode;
}

// White bg, 1px border-strong, radius-md, ~48px height, text-tertiary
// placeholder color (Design §7 input spec). An error swaps the border to
// brand-red-dark and shows the message below in the same tone.
export function TextField({
  label,
  error,
  iconLeft,
  rightAction,
  style,
  ...inputProps
}: TextFieldProps) {
  return (
    <View className="mb-4">
      <Text className="font-ui text-micro uppercase tracking-wide text-text-secondary mb-2">
        {label}
      </Text>
      <View
        className={[
          'flex-row items-center bg-surface rounded-md border px-4',
          error ? 'border-brand-red-dark' : 'border-border-strong',
        ].join(' ')}
        style={{ height: 48 }}
      >
        {iconLeft ? <View className="mr-3">{iconLeft}</View> : null}
        <TextInput
          className="flex-1 font-ui text-body"
          style={[{ color: '#111111' }, style]}
          placeholderTextColor="#767676"
          {...inputProps}
        />
        {rightAction ? <View className="ml-3">{rightAction}</View> : null}
      </View>
      {error ? <Text className="font-ui text-micro text-brand-red-dark mt-1">{error}</Text> : null}
    </View>
  );
}
