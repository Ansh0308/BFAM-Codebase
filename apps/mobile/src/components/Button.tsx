import React from 'react';
import { Pressable, Text, View, PressableProps } from 'react-native';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { BallLoader } from './BallLoader';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Briefly swaps the label for a checkmark — use for a confirmed action
   * right before navigating away, e.g. a successful login. */
  success?: boolean;
  /** Text shown next to the checkmark during `success` (e.g. "Account
   * Created"). Omit for an icon-only success state. */
  successLabel?: string;
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
  success = false,
  successLabel,
  fullWidth = true,
  disabled,
  iconLeft,
  iconRight,
  ...pressableProps
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isDisabled = disabled || loading || success;

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
        isDisabled && !success ? 'opacity-50' : '',
      ].join(' ')}
      style={({ pressed }) => [
        { minHeight: 44, transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }] },
        isPrimary && pressed && !isDisabled ? { backgroundColor: colors.brandRedDark } : null,
      ]}
      {...pressableProps}
    >
      {success ? (
        <MotiView
          from={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 180 }}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Feather name="check" size={20} color={isPrimary ? '#FFFFFF' : colors.inkBlack} />
          {successLabel ? (
            <Text
              className={['font-ui text-button uppercase tracking-wide ml-2', textColorClass].join(
                ' ',
              )}
            >
              {successLabel}
            </Text>
          ) : null}
        </MotiView>
      ) : loading ? (
        <BallLoader size="button" tone={isPrimary ? 'light' : 'default'} />
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
