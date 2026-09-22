import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, Platform } from 'react-native';
import { colors } from '../theme/tokens';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /** e.g. a person/lock icon rendered inside the field, left-aligned. */
  iconLeft?: React.ReactNode;
  /** e.g. a password show/hide toggle, right-aligned inside the field. */
  rightAction?: React.ReactNode;
  /**
   * Renders `label` as-typed (e.g. "Phone or Email") instead of the
   * default all-caps treatment. Default true (unchanged everywhere else)
   * — Login/Signup pass false since their labels are meant to read as
   * proper case, not a shouted micro-header.
   */
  uppercaseLabel?: boolean;
}

// White bg, 1px border-strong, radius-md, ~48px height, text-tertiary
// placeholder color (Design §7 input spec). An error swaps the border to
// brand-red-dark; a focused field swaps it to brand-red (same pattern as
// OtpInput) instead of relying on the browser's default focus outline,
// which clashes with this bordered-field design on web.
export function TextField({
  label,
  error,
  iconLeft,
  rightAction,
  uppercaseLabel = true,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const iconColor = error ? colors.brandRedDark : isFocused ? colors.brandRed : colors.textTertiary;
  const styledIconLeft =
    iconLeft && React.isValidElement(iconLeft)
      ? React.cloneElement(iconLeft as React.ReactElement<{ color?: string }>, { color: iconColor })
      : iconLeft;

  return (
    <View className="mb-4">
      <Text
        className={[
          'font-ui text-micro tracking-wide text-text-secondary mb-2',
          uppercaseLabel ? 'uppercase' : '',
        ].join(' ')}
      >
        {label}
      </Text>
      <View
        className={[
          'flex-row items-center bg-surface rounded-md border px-4',
          error ? 'border-brand-red-dark' : isFocused ? 'border-brand-red' : 'border-border-strong',
        ].join(' ')}
        style={[
          { height: 48, borderWidth: isFocused || error ? 1.5 : 1 },
          isFocused && Platform.OS === 'ios'
            ? {
                shadowColor: colors.brandRed,
                shadowOpacity: 0.15,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }
            : null,
        ]}
      >
        {styledIconLeft ? <View className="mr-3">{styledIconLeft}</View> : null}
        <TextInput
          className="flex-1 font-ui text-body"
          style={[{ color: '#111111', outlineStyle: 'none' } as object, style]}
          placeholderTextColor="#767676"
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {rightAction ? <View className="ml-3">{rightAction}</View> : null}
      </View>
      {error ? <Text className="font-ui text-micro text-brand-red-dark mt-1">{error}</Text> : null}
    </View>
  );
}
