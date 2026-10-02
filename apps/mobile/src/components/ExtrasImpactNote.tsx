import React from 'react';
import { Text } from 'react-native';
import type { ExtrasImpact } from '@bfam/shared-types';

// "About 3 min" / "about 45 sec" — the time is an estimate (see backend
// domain/extrasImpact.ts), so it is always worded as one.
export function formatTimeLost(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// The sentence shown under an innings' extras on the scorecard and the match
// summary: how much play the wides and no-balls cost, in time and in balls.
export function extrasImpactText(impact: ExtrasImpact): string {
  if (impact.rebowled_deliveries === 0) return 'No time lost to extra deliveries.';
  const parts: string[] = [];
  if (impact.wides > 0) parts.push(plural(impact.wides, 'wide'));
  if (impact.no_balls > 0) parts.push(plural(impact.no_balls, 'no-ball'));
  return (
    `About ${formatTimeLost(impact.estimated_seconds_lost)} lost to ` +
    `${plural(impact.rebowled_deliveries, 'extra delivery', 'extra deliveries')} ` +
    `(${parts.join(', ')}) — roughly ${plural(impact.rebowled_deliveries, 'more ball')} ` +
    `could have been played.`
  );
}

export function ExtrasImpactNote({
  impact,
  testID,
  className = 'font-ui text-body text-text-secondary',
}: {
  impact?: ExtrasImpact;
  testID?: string;
  className?: string;
}) {
  if (!impact) return null;
  return (
    <Text className={className} testID={testID}>
      {extrasImpactText(impact)}
    </Text>
  );
}
