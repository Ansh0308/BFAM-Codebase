import React from 'react';
import { Pressable, Text, View, ActivityIndicator, PressableProps } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  /** Rendered left of the label — e.g. a brand icon on an outlined button. */
  iconLeft?: React.ReactNode;
  /** Rendered right of the label — e.g. the arrow on a primary CTA. */
  iconRight?: React.ReactNode;
}

// Primary: brand-red bg, white uppercase Inter 700 text, optional right-
// aligned icon (Design §4.1: "Icon: right-aligned arrow, same color as
// text, 8px gap from label"). Secondary/ghost: white bg, 1px border,
// ink-black or brand-red text/icon. All variants use radius-md (never
// pill-shaped) and meet the 44x44 minimum touch target.
export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  iconLeft,
  iconRight,
  ...pressableProps
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isDisabled = disabled || loading;

  const textColorClass = isPrimary ? 'text-white' : isGhost ? 'text-brand-red' : 'text-ink-black';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      className={[
        'rounded-md py-4 px-6 flex-row items-center justify-center',
        fullWidth ? 'w-full' : '',
        isPrimary
          ? 'bg-brand-red'
          : isGhost
            ? 'bg-surface border border-brand-red'
            : 'bg-surface border border-ink-black',
        isDisabled ? 'opacity-50' : '',
      ].join(' ')}
      style={{ minHeight: 44 }}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#0D0D0D'} />
      ) : (
        <>
          {iconLeft ? <View className="mr-2">{iconLeft}</View> : null}
          <Text
            className={['font-ui text-button uppercase tracking-wide', textColorClass].join(' ')}
          >
            {label}
          </Text>
          {iconRight ? <View className="ml-2">{iconRight}</View> : null}
        </>
      )}
    </Pressable>
  );
}
