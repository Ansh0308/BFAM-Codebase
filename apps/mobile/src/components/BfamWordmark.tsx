import React from 'react';
import { Text, TextProps } from 'react-native';

// Simple text-based wordmark using font-display (Anton/Archivo Black) —
// no logo asset needed for this module.
export function BfamWordmark({ className, ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={['font-display text-hero text-ink-black', className].filter(Boolean).join(' ')}
      {...props}
    >
      BFAM
    </Text>
  );
}
