import React from 'react';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { CricketBallIcon } from './CricketBallIcon';

interface CricketBallSpinnerProps {
  size?: number;
  color?: string;
}

// Loading indicator built from the ball motif instead of a generic spinner
// — same shape, same restrained line-art, just continuously spinning.
export function CricketBallSpinner({ size = 20, color = '#FFFFFF' }: CricketBallSpinnerProps) {
  return (
    <MotiView
      from={{ rotate: '0deg' }}
      animate={{ rotate: '360deg' }}
      transition={{
        type: 'timing',
        duration: 850,
        easing: Easing.linear,
        loop: true,
        repeatReverse: false,
      }}
    >
      <CricketBallIcon size={size} color={color} strokeWidth={1.5} />
    </MotiView>
  );
}
