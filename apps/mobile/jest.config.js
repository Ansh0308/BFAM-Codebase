// jest-expo's default transformIgnorePatterns doesn't include `moti` (ships
// ESM), so it fails to parse under Jest's default node_modules exclusion.
// Extending the preset's own pattern here (rather than hand-writing a new
// regex) keeps this in sync with whatever jest-expo already allowlists.
const {
  transformIgnorePatterns: presetTransformIgnorePatterns,
} = require('jest-expo/jest-preset.js');

module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@bfam/api-client$': '<rootDir>/../../packages/api-client/index.ts',
    '^@bfam/shared-types$': '<rootDir>/../../packages/shared-types/index.ts',
  },
  transformIgnorePatterns: [
    presetTransformIgnorePatterns[0].replace('react-native-svg)', 'react-native-svg|moti)'),
    ...presetTransformIgnorePatterns.slice(1),
  ],
};
