import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import logoStacked from '../assets/brand/logo-stacked.png';
import logoHorizontal from '../assets/brand/logo-horizontal.png';
import logoMark from '../assets/brand/logo-mark.png';

// The BFAM logo (B monogram with batter and bowler, wordmark, tagline), from the
// approved brand sheet. Pick the lockup that fits the space and give ONE of
// height/width; the other follows from the artwork's proportions.
//   stacked     monogram above the wordmark and tagline (splash, hero areas)
//   horizontal  monogram beside the wordmark and tagline (headers, top bars)
//   mark        the monogram alone
const VARIANTS = {
  stacked: { source: logoStacked, ratio: 1000 / 1042 },
  horizontal: { source: logoHorizontal, ratio: 999 / 262 },
  mark: { source: logoMark, ratio: 720 / 598 },
} as const;

export type BrandLogoVariant = keyof typeof VARIANTS;

export function BrandLogo({
  variant = 'horizontal',
  height,
  width,
  style,
  testID = 'brand-logo',
}: {
  variant?: BrandLogoVariant;
  height?: number;
  width?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}) {
  const { source, ratio } = VARIANTS[variant];
  const h = height ?? (width ? width / ratio : 40);
  const w = width ?? h * ratio;
  return (
    <Image
      source={source}
      style={[{ width: w, height: h }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="BFAM - Brother From Another Mother"
      testID={testID}
    />
  );
}
