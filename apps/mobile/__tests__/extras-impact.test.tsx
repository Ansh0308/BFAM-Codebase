import React from 'react';
import { render } from '@testing-library/react-native';
import type { ExtrasImpact } from '@bfam/shared-types';
import {
  ExtrasImpactNote,
  extrasImpactText,
  formatTimeLost,
} from '../src/components/ExtrasImpactNote';

const impact = (over: Partial<ExtrasImpact> = {}): ExtrasImpact => ({
  wides: 0,
  no_balls: 0,
  byes: 0,
  leg_byes: 0,
  rebowled_deliveries: 0,
  seconds_per_delivery: 30,
  estimated_seconds_lost: 0,
  ...over,
});

describe('extras time-lost text', () => {
  it('formats the time in seconds or minutes', () => {
    expect(formatTimeLost(20)).toBe('20 sec');
    expect(formatTimeLost(90)).toBe('2 min');
    expect(formatTimeLost(600)).toBe('10 min');
  });

  it('says how much play wides and no-balls cost', () => {
    const text = extrasImpactText(
      impact({ wides: 3, no_balls: 1, rebowled_deliveries: 4, estimated_seconds_lost: 120 }),
    );
    expect(text).toContain('About 2 min lost to 4 extra deliveries');
    expect(text).toContain('3 wides, 1 no-ball');
    expect(text).toContain('roughly 4 more balls could have been played');
  });

  it('uses singular wording for a single extra delivery', () => {
    const text = extrasImpactText(
      impact({ wides: 1, rebowled_deliveries: 1, estimated_seconds_lost: 40 }),
    );
    expect(text).toContain('1 extra delivery');
    expect(text).toContain('1 wide)');
    expect(text).toContain('1 more ball could');
  });

  it('is a clean message when there were none', () => {
    expect(extrasImpactText(impact())).toBe('No time lost to extra deliveries.');
  });

  it('renders nothing when the server sent no data (older matches)', async () => {
    const { toJSON } = await render(<ExtrasImpactNote impact={undefined} />);
    expect(toJSON()).toBeNull();
  });
});
