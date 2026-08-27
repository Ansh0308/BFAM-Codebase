const sharedConfig = require('../../tailwind.config.shared.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      ...sharedConfig.theme.extend,
    },
  },
  plugins: [],
};
