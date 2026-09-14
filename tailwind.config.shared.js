/**
 * Shared Tailwind configuration for BFAM
 * Used by both mobile (NativeWind) and web (Next.js) apps
 * Design tokens extracted from BFAM_Design_Document.md §7
 */

const colors = {
  // Brand Colors
  'brand-red': '#D80000',
  'brand-red-dark': '#B80000',
  'brand-red-light': '#E85A58',

  // Neutrals
  'ink-black': '#0D0D0D',
  'pure-black': '#000000',
  surface: '#FFFFFF',
  'surface-alt': '#F8F8F8',

  // Text
  'text-primary': '#111111',
  'text-secondary': '#444444',
  'text-tertiary': '#767676',

  // Borders & Surfaces
  'border-subtle': '#EEEDEE',
  'border-strong': '#E0E0E0',
  'disabled-surface': '#F3F3F3',

  // Semantic
  'live-indicator': '#D80000',
  success: '#D80000',
  available: '#D80000',
  'rating-star': '#CE0002',

  // Status badges — a real semantic palette (distinct from the brand red
  // used for CTAs/live) so a status flag's color actually carries meaning:
  // green for a good/settled state, amber for waiting, red for a bad
  // outcome, blue for informational, grey for a closed/inactive one.
  'status-success': '#1E7B4D',
  'status-success-bg': '#E7F5EE',
  'status-warning': '#9A6B00',
  'status-warning-bg': '#FBF1DC',
  'status-danger': '#A80000',
  'status-danger-bg': '#FDECEC',
  'status-info': '#1D5DAD',
  'status-info-bg': '#EAF1FB',
  'status-neutral': '#767676',
  'status-neutral-bg': '#F0F0F0',

  // Tailwind defaults for fallback
  transparent: 'transparent',
  current: 'currentColor',
  black: '#000000',
  white: '#FFFFFF',
};

const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
  7: '40px',
};

const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '50%',
};

const boxShadow = {
  card: '0 2px 8px rgba(0, 0, 0, 0.06)',
};

module.exports = {
  theme: {
    extend: {
      colors,
      spacing,
      borderRadius,
      boxShadow,
      fontFamily: {
        display: ['Anton', 'Archivo Black', 'Impact', 'sans-serif'],
        ui: ['Inter', '-apple-system', 'SF Pro Display', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Hero Display: 56-64px
        hero: ['56px', { lineHeight: '1.1', fontWeight: '900' }],
        // Screen Title: 40-44px
        'title-xl': ['36px', { lineHeight: '1.15', fontWeight: '700' }],
        // Section Header: 22-26px
        'section-header': ['22px', { lineHeight: '1.2', fontWeight: '700' }],
        // Card Title: 20-22px
        'card-title': ['19px', { lineHeight: '1.25', fontWeight: '600' }],
        // Stat Number (large): 40-48px
        'stat-lg': ['44px', { lineHeight: '1', fontWeight: '800' }],
        // Stat Number (small): 18-22px
        'stat-sm': ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        // Body / Metadata: 14-15px
        body: ['14px', { lineHeight: '1.5', fontWeight: '500' }],
        // Micro Label: 11-12px
        micro: ['12px', { lineHeight: '1.3', fontWeight: '600' }],
        // Button Label: 15-16px
        button: ['16px', { lineHeight: '1.4', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
