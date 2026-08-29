module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // jest-expo's default pattern already allow-lists the RN/Expo packages it
  // needs to transform; `@bfam/*` is appended so our workspace-linked
  // packages (consumed as TypeScript source, not a pre-built dist/) get
  // transformed too instead of being skipped as "node_modules".
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@bfam/.*)',
  ],
};
