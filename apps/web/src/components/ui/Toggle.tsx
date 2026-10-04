'use client';

import React from 'react';
import { motion } from 'motion/react';

// An on/off switch with a springy thumb. Brand red when on.
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  testID,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-testid={testID}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-[999px] p-[3px] transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand-red shadow-[0_4px_14px_rgba(216,0,0,0.3)]' : 'bg-border-strong'
      }`}
    >
      <motion.span
        className="block h-[20px] w-[20px] rounded-[999px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      />
    </button>
  );
}
