const sharedConfig = require('../../tailwind.config.shared.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // react-native-css-interop's web runtime throws on its own internal
  // system-color-scheme listener when darkMode is left at Tailwind's
  // default "media" ("Cannot manually set color scheme, as dark mode is
  // type 'media'..."). This module doesn't implement dark mode (Design
  // Doc has no dark variant yet), so "class" (manual, never auto-triggered
  // since nothing calls setColorScheme) sidesteps the crash.
  darkMode: 'class',
  theme: {
    extend: {
      ...sharedConfig.theme.extend,
    },
  },
  plugins: [],
};
