// Mirrors tailwind.config.shared.js (BFAM_Design_Document.md §7). Use these
// only where a literal value is required outside NativeWind's className
// (e.g. React Navigation's tabBarActiveTintColor, ActivityIndicator color).
// Everywhere else, prefer NativeWind className utilities so both apps stay
// on one shared token source.
export const colors = {
  brandRed: '#D80000',
  brandRedDark: '#B80000',
  brandRedLight: '#E85A58',
  inkBlack: '#0D0D0D',
  pureBlack: '#000000',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F8F8',
  textPrimary: '#111111',
  textSecondary: '#444444',
  textTertiary: '#767676',
  borderSubtle: '#EEEDEE',
  borderStrong: '#E0E0E0',
  disabledSurface: '#F3F3F3',
  liveIndicator: '#D80000',
  ratingStar: '#CE0002',
} as const;
