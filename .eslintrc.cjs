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
    // Both promoted to 'error': the "no hard waits, no skipped tests" rules in
    // CLAUDE.md are only real if the gate actually fails on them.
    // `allowConditional` still permits runtime guards — `test.skip(cond, reason)`
    // for account/environment state a spec genuinely cannot control — while a
    // blanket `test.skip()` or `test.describe.skip()` now fails the build.
    'playwright/no-skipped-test': ['error', { allowConditional: true }],
    'playwright/no-wait-for-timeout': 'error',
    'playwright/expect-expect': 'off',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
  overrides: [
    {
      // Page objects are not tests. Now that POM methods wrap their bodies in
      // `test.step()`, the Playwright plugin's test-body heuristics treat those
      // callbacks as test bodies and flag ordinary defensive branching inside
      // behaviour helpers. The rule stays on for everything under tests/.
      files: ['src/pages/**/*.ts'],
      rules: {
        'playwright/no-conditional-in-test': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'playwright-report/', 'test-results/'],
};
