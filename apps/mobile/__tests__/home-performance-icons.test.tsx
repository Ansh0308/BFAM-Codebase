import React from 'react';
import { render } from '@testing-library/react-native';
import { PerformanceCard } from '../src/components/home/HomeParts';

// Feedback: the Performance card's Runs stat showed MaterialCommunityIcons'
// "baseball-bat" glyph (a round-barrelled baseball bat), not a cricket bat.
describe('Home Performance card icons', () => {
  it('does not use the baseball-bat glyph for Runs', async () => {
    const { toJSON } = await render(
      <PerformanceCard matches={3} runs={120} wickets={2} streak={1} onViewDetails={() => {}} />,
    );

    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('baseball-bat');
    // Runs now renders CricketBatIcon's own line-art SVG instead of an icon-font glyph.
    expect(tree).toContain('RNSVGSvgView');
  });
});
