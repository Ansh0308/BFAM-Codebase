import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'live';

interface StatusBadgeProps {
  label: string;
  variant: StatusVariant;
  testID?: string;
}

const VARIANT_CLASSES: Record<StatusVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-status-success-bg', text: 'text-status-success', dot: 'bg-status-success' },
  warning: { bg: 'bg-status-warning-bg', text: 'text-status-warning', dot: 'bg-status-warning' },
  danger: { bg: 'bg-status-danger-bg', text: 'text-status-danger', dot: 'bg-status-danger' },
  info: { bg: 'bg-status-info-bg', text: 'text-status-info', dot: 'bg-status-info' },
  neutral: { bg: 'bg-status-neutral-bg', text: 'text-status-neutral', dot: 'bg-status-neutral' },
  live: { bg: 'bg-brand-red', text: 'text-white', dot: 'bg-white' },
};

// Status flags (match/booking/payment/ticket/verification state, etc.),
// replaced from a single "everything is a red-bordered pill" look — every
// status now carries a color that actually means something (green/settled,
// amber/waiting, red/stopped, blue/informational, grey/closed), plus a
// pulsing dot reserved for a genuinely live state.
export function StatusBadge({ label, variant, testID }: StatusBadgeProps) {
  const { bg, text, dot } = VARIANT_CLASSES[variant];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (variant !== 'live') return;
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [variant, pulse]);

  return (
    <View
      className={`flex-row items-center self-start rounded-md px-2.5 py-1 ${bg}`}
      testID={testID}
    >
      {/* className is not processed on Animated components; the pulse wraps a plain View. */}
      <Animated.View
        style={{ width: 6, height: 6, marginRight: 6, opacity: variant === 'live' ? pulse : 1 }}
      >
        <View className={`rounded-full ${dot}`} style={{ width: 6, height: 6 }} />
      </Animated.View>
      <Text className={`font-ui text-micro font-bold uppercase tracking-wide ${text}`}>
        {label}
      </Text>
    </View>
  );
}
