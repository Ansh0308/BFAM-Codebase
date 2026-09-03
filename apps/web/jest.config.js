/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@bfam/api-client$': '<rootDir>/../../packages/api-client/index.ts',
    '^@bfam/shared-types$': '<rootDir>/../../packages/shared-types/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
