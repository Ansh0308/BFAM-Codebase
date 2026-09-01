import React from 'react';
import { Text } from 'react-native';

interface BfamIdBadgeProps {
  bfamId: string;
  size?: 'sm' | 'lg';
}

// Design §4.3: "BFAM ID badge (e.g. 'BF1007'): brand-red text, Inter 700,
// no background — functions as a colored label, not a chip."
export function BfamIdBadge({ bfamId, size = 'sm' }: BfamIdBadgeProps) {
  return (
    <Text
      className={[
        'font-ui font-bold text-brand-red',
        size === 'lg' ? 'text-card-title' : 'text-body',
      ].join(' ')}
    >
      {bfamId}
    </Text>
  );
}
