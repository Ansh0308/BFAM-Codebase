import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface CricketBallIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Adds small cross-stitch ticks along the seam — only reads clearly at
   * larger sizes (ambient/decorative use), skip on small icon-sized marks. */
  showStitches?: boolean;
}

// A restrained, line-art cricket ball: an outlined circle with a stitched
// seam, drawn the same way our Feather icons read (stroke-only, no fill) so
// it sits as a piece of iconography rather than an illustration.
export function CricketBallIcon({
  size = 20,
  color = '#FFFFFF',
  strokeWidth = 1.5,
  showStitches = false,
}: CricketBallIconProps) {
  const r = size / 2 - strokeWidth;
  const cx = size / 2;
  const cy = size / 2;

  const stitchTs = [-0.62, -0.32, 0, 0.32, 0.62];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d={`M ${cx + r * 0.22} ${cy - r} Q ${cx - r * 0.62} ${cy} ${cx + r * 0.22} ${cy + r}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${cx - r * 0.22} ${cy - r} Q ${cx + r * 0.62} ${cy} ${cx - r * 0.22} ${cy + r}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      {showStitches
        ? stitchTs.map((t, i) => {
            const y = cy + t * r;
            const curveX = 1 - t * t;
            const xRight = cx + r * 0.22 - curveX * r * 0.4;
            const xLeft = cx - r * 0.22 + curveX * r * 0.4;
            return (
              <React.Fragment key={i}>
                <Path
                  d={`M ${xRight - 2} ${y - 1.4} L ${xRight + 2} ${y + 1.4}`}
                  stroke={color}
                  strokeWidth={strokeWidth * 0.7}
                  strokeLinecap="round"
                />
                <Path
                  d={`M ${xLeft - 2} ${y - 1.4} L ${xLeft + 2} ${y + 1.4}`}
                  stroke={color}
                  strokeWidth={strokeWidth * 0.7}
                  strokeLinecap="round"
                />
              </React.Fragment>
            );
          })
        : null}
    </Svg>
  );
}
