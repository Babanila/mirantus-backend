import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * IMPORTANT
 *
 * NestJS dependency injection relies on TypeScript decorator metadata
 * (Reflect.getMetadata('design:paramtypes')).
 *
 * Vitest's default esbuild transformer strips decorator metadata,
 * causing Nest providers to fail with: "ConfigService was not injected"
 *
 * We therefore use SWC as the transformer with:
 *   transform.decoratorMetadata = true
 * Do NOT remove this configuration unless replacing the test runner.
 */

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/screening_orders_test?sslmode=disable',
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      API_PORT: '3001',
      CORS_ORIGIN: 'http://localhost:3000',
      DB_POOL_MAX: '10',
      DB_POOL_MIN: '2',
      DB_CONNECT_TIMEOUT_MS: '5000',
    },
    globals: true,
    environment: 'node',
    pool: 'threads',
    poolOptions: {
      threads: { 
        singleThread: true, // REQUIRED: Prevents concurrent DB access between tests
        isolate: true
      }
    },
    include: ['src/**/*.spec.ts', 'test/**/*.e2e.ts'],
    exclude: [
      'node_modules', 
      'dist', 
      'src/migrations/**',
      'test/app.factory.ts',  // Helper modules ≠ test files
      'test/database-setup.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts',
        '**/*.e2e.ts',
        '**/*.config.ts',
        '**/main.ts',
        '**/migrations/**',
        'test/**/*.{ts,js}', // Exclude ALL test helper utilities from coverage
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 75000,
    hookTimeout: 75000,
    teardownTimeout: 10000,
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
