// jest-expo's default transformIgnorePatterns doesn't include `moti` (ships
// ESM), so it fails to parse under Jest's default node_modules exclusion.
// Extending the preset's own pattern here (rather than hand-writing a new
// regex) keeps this in sync with whatever jest-expo already allowlists.
const {
  transformIgnorePatterns: presetTransformIgnorePatterns,
} = require('jest-expo/jest-preset.js');

module.exports = {
  preset: 'jest-expo',
  // Reanimated 4 split its native code out into react-native-worklets;
  // under Jest (no real native module available) its `.native.ts` entry
  // points try to initialize the real native side and crash with
  // "Native part of Worklets doesn't seem to be initialized". This
  // resolver (shipped by react-native-worklets itself) makes Jest resolve
  // its plain JS/mock files instead — the officially documented fix for
  // Reanimated 4 test environments.
  resolver: 'react-native-worklets/jest/resolver',
  moduleNameMapper: {
    '^@bfam/api-client$': '<rootDir>/../../packages/api-client/index.ts',
    '^@bfam/shared-types$': '<rootDir>/../../packages/shared-types/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // jest-expo's own allowlist regex changed shape between SDK versions
  // (SDK 54's preset no longer mentions react-native-svg by name at all),
  // so rather than pattern-match a specific substring that keeps moving,
  // just widen whatever the preset's own closing `))` is with `|moti`.
  transformIgnorePatterns: [
    presetTransformIgnorePatterns[0].replace(/\)\)$/, '|moti))'),
    ...presetTransformIgnorePatterns.slice(1),
  ],
};
