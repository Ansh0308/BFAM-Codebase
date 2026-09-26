import React, { useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';

interface CountUpProps extends Omit<TextProps, 'children'> {
  value: number;
  duration?: number;
}

// Short ease-out count from the previously shown value to `value` — 0 -> N
// on first paint, then N -> M whenever a refresh brings a new number. Ends
// exactly on `value` (never leaves a rounded-off intermediate on screen),
// and a value that hasn't changed doesn't re-animate.
export function CountUp({ value, duration = 700, ...textProps }: CountUpProps) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === value) {
      setShown(value);
      return;
    }
    const t0 = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (progress >= 1) {
        clearInterval(timer);
        from.current = value;
      }
    }, 16);
    return () => {
      clearInterval(timer);
      from.current = value;
    };
  }, [value, duration]);

  return <Text {...textProps}>{shown}</Text>;
}
