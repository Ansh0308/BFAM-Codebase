'use client';

import React from 'react';
import { DotLottieReact as DotLottiePlayer } from '@lottiefiles/dotlottie-react';
import cricketBallLoaderAnimation from '../assets/animations/cricket-bat-ball-loader.json';
import cricketBallLoaderAnimationLight from '../assets/animations/cricket-bat-ball-loader-white.json';

// The same cricket bat & ball loader the mobile app uses, for every loading
// state on Owner / Staff / Admin Web. tone="light" is the white variant for
// dark backgrounds (the scoreboard display screen).
// The player's typings resolve the monorepo-root React types (a newer major
// than this app's), so its component type doesn't line up with ours — narrow
// it to the few props used here.
const DotLottieReact = DotLottiePlayer as unknown as React.ComponentType<{
  data: unknown;
  loop?: boolean;
  autoplay?: boolean;
  style?: React.CSSProperties;
}>;

const DIMENSION = { page: 180, inline: 120, small: 72 } as const;

export function BallLoader({
  size = 'page',
  tone = 'default',
  label,
  className,
}: {
  size?: keyof typeof DIMENSION;
  tone?: 'default' | 'light';
  label?: string;
  className?: string;
}) {
  const dimension = DIMENSION[size];
  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Loading'}
      className={['flex flex-col items-center justify-center w-full py-6', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div style={{ width: dimension, height: dimension }}>
        <DotLottieReact
          data={tone === 'light' ? cricketBallLoaderAnimationLight : cricketBallLoaderAnimation}
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {label ? (
        <span className="font-ui text-micro uppercase tracking-widest text-text-secondary mt-1">
          {label}
        </span>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}
