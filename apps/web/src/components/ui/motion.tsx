'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// Fade + rise on mount. `delay` staggers siblings; reduced-motion users get
// the content immediately with no movement.
export function FadeIn({
  children,
  delay = 0,
  y = 12,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// Reveals when scrolled into view, once.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={inView || reduce ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// Eased number count-up (0 -> value, then old -> new on change). Renders the
// final value straight away for reduced-motion users, and exposes it as a
// data attribute so tests don't have to wait for the animation.
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  duration = 0.9,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => {
        from.current = value;
        setShown(value);
      },
    });
    return () => {
      controls.stop();
      from.current = value;
    };
  }, [value, duration, reduce]);

  return (
    <span className={className} data-value={value}>
      {prefix}
      {shown.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}
