import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Expose describe / it / expect / vi as globals so test files don't need
     * to import them individually.  TypeScript picks these up via the
     * "vitest/globals" reference in src/types/vitest.d.ts.
     */
    globals: true,

    environment: 'node',

    /**
     * Two separate test sets — each targeted by a separate npm script:
     *
     *   npm run test:unit         → vitest run src   (*.spec.ts files in src/)
     *   npm run test:integration  → vitest run test  (*.e2e.ts files in test/)
     *
     * The CLI directory argument (`src` or `test`) filters which of these
     * glob patterns is matched per run.
     */
    include: ['src/**/*.spec.ts', 'test/**/*.e2e.ts'],

    /**
     * Never import migration files during test runs — they contain raw SQL
     * that TypeORM's migration runner must execute, not Vitest.
     */
    exclude: ['node_modules', 'dist', 'src/migrations/**'],

    /**
     * Coverage via V8 (no Babel required).
     * Run with: npm run test:cov
     */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.module.ts',
        'src/main.ts',
        'src/migrations/**',
        'src/types/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },

    /**
     * Realistic timeout for integration tests that hit a real Postgres instance.
     * Unit tests are fast and will finish well within this window.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
