module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist/**', 'vitest.config.ts'],
  rules: {
    // NestJS interfaces don't need I-prefix
    '@typescript-eslint/interface-name-prefix': 'off',

    // Return types are enforced by TypeScript strict mode instead
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // Warn on any — strict mode already catches most; allows escape hatch in tests
    '@typescript-eslint/no-explicit-any': 'warn',

    // Catch unused vars; prefix _ to opt out intentionally
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // Void promises must be handled
    '@typescript-eslint/no-floating-promises': 'error',

    // Consistent type assertions
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      { assertionStyle: 'as' },
    ],

    // Require await in async functions (prevents accidental sync)
    '@typescript-eslint/require-await': 'warn',
  },
};
