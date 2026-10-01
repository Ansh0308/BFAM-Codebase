import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface CricketBatIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// A restrained, line-art cricket bat — the flat, shouldered blade and short
// handle a cricket bat actually has, not a baseball bat's round barrel.
// Drawn the same stroke-only way as CricketBallIcon so the two sit together
// as one small icon set (e.g. the Home Performance card's Matches/Runs
// stats) rather than mixing in a generic sports glyph.
export function CricketBatIcon({
  size = 22,
  color = '#0D0D0D',
  strokeWidth = 1.5,
}: CricketBatIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Blade: shouldered at the top, flat-faced, rounded toe at the bottom. */}
      <Path
        d="M12.6 3.2
           C 15.3 3.2 16.4 5.1 16.1 7.6
           L 14.9 16.4
           C 14.7 17.9 13.9 18.8 12.4 18.8
           C 10.9 18.8 10.2 17.8 10.3 16.3
           L 11.1 7.5
           C 11.3 5 10.4 3.2 12.6 3.2 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Spine line down the face of the blade. */}
      <Path
        d="M12.6 4.6 L 11.9 16.6"
        stroke={color}
        strokeWidth={strokeWidth * 0.7}
        strokeLinecap="round"
      />
      {/* Handle, wrapped with a grip band. */}
      <Rect
        x={10.9}
        y={17.2}
        width={2.9}
        height={4.4}
        rx={1.3}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        transform="rotate(-3 12.4 19.4)"
      />
      <Path
        d="M11 19 L13.7 18.8"
        stroke={color}
        strokeWidth={strokeWidth * 0.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}
