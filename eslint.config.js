const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

const globals = {
  console: 'readonly',
  Headers: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setTimeout: 'readonly',
  fetch: 'readonly',
};

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.expo/**',
      'dist/**',
      'build/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/.expo/**',
      '**/dist/**',
      '**/build/**',
    ],
  },
  {
    languageOptions: {
      globals,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-namespace': 'off',
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
