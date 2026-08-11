/**
 * ESLint configuration for the KPost UI automation framework.
 * Enforces TypeScript hygiene and Playwright-specific best practices
 * (no focused/skipped tests leaking into CI, no manual waitForTimeout, etc.).
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'playwright'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:playwright/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    'playwright/no-focused-test': 'error',
    'playwright/no-skipped-test': 'warn',
    'playwright/no-wait-for-timeout': 'warn',
    'playwright/expect-expect': 'off',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
  ignorePatterns: ['node_modules/', 'dist/', 'playwright-report/', 'test-results/'],
};
