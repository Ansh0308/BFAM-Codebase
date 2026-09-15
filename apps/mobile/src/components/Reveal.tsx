import React, { useEffect, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { MotiView } from 'moti';

interface RevealProps {
  /** Forwarded to the underlying MotiView — use for layout (e.g. `flex: 1`)
   * on a Reveal that needs to participate in a flex row/column. */
  style?: StyleProp<ViewStyle>;
  /** When provided, the entrance only plays once `active` first becomes
   * true — for content mounted off-screen (e.g. a carousel slide that
   * hasn't been swiped to yet), so the animation is still visible instead
   * of having already finished before anyone sees it. Omit for content
   * that's on-screen at mount (defaults to always-active). */
  active?: boolean;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'left' | 'right';
  distance?: number;
  children: React.ReactNode;
}

// Shared staggered fade+rise/slide entrance — a screen's sections should
// arrive a beat apart (logo, then hero, then headline, then CTA) rather
// than all at once. Used across onboarding and auth screens for one
// consistent feel, with a direction knob so each onboarding chapter can
// still have its own entrance character (image from the right, type from
// the left, etc.) without a bespoke animation per screen.
export function Reveal({
  style,
  active = true,
  delay = 0,
  duration = 260,
  direction = 'up',
  distance = 10,
  children,
}: RevealProps) {
  const [entered, setEntered] = useState(active);

  useEffect(() => {
    if (active) setEntered(true);
  }, [active]);

  const offset =
    direction === 'up'
      ? { translateY: distance }
      : direction === 'left'
        ? { translateX: -distance }
        : { translateX: distance };
  const rest = direction === 'up' ? { translateY: 0 } : { translateX: 0 };

  return (
    <MotiView
      style={style}
      from={{ opacity: 0, ...offset }}
      animate={entered ? { opacity: 1, ...rest } : { opacity: 0, ...offset }}
      transition={{ type: 'timing', duration, delay: entered ? delay : 0 }}
    >
      {children}
    </MotiView>
  );
}
