/**
 * config.service.ts
 *
 * AppConfigService — typed wrapper around NestJS ConfigService.
 *
 * Authority: TASKS.md T-02 / SPEC.md §13.
 *
 * WHY a wrapper?
 *   NestJS ConfigService.get<T>(key) returns `T | undefined` by default.
 *   Scattered `getOrThrow` calls and explicit casts throughout the codebase
 *   are error-prone.  This service converts every variable into a concrete
 *   typed getter so callers receive `string`, `number`, or `boolean` — never
 *   `string | undefined`.
 *
 * HOW it stays safe:
 *   Joi validates DATABASE_URL is present at boot (configSchema in config.schema.ts).
 *   Optional variables have defaults, so get<T>(key, default) always returns T.
 *   databaseUrl uses getOrThrow() as an explicit safety net for test environments
 *   that might bypass the module's Joi validation.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Mirrors the NODE_ENV constraint in config.schema.ts. */
export type NodeEnv = 'development' | 'test' | 'production';

/** Mirrors the LOG_LEVEL constraint in config.schema.ts. */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  // ── Database ─────────────────────────────────────────────────────────────

  /**
   * Full PostgreSQL connection string.
   * REQUIRED — getOrThrow() guarantees string, not string | undefined.
   * Joi validation in AppConfigModule ensures this is present at boot,
   * so the throw path is only reachable in misconfigured test environments.
   */
  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  // ── Runtime ───────────────────────────────────────────────────────────────

  get nodeEnv(): NodeEnv {
    return this.config.get<NodeEnv>('NODE_ENV', 'development');
  }

  /** HTTP port.  Defaults to 3000. */
  get apiPort(): number {
    return this.config.get<number>('API_PORT', 3000);
  }

  /** Winston log level.  Defaults to 'info'. */
  get logLevel(): LogLevel {
    return this.config.get<LogLevel>('LOG_LEVEL', 'info');
  }

  // ── CORS ──────────────────────────────────────────────────────────────────

  /**
   * Returns the CORS_ORIGIN env var as a trimmed string[].
   * Comma-separated values in the env var become multiple allowed origins.
   *
   * Example:
   *   CORS_ORIGIN=http://localhost:5173,https://app.mirantus.com
   *   → ['http://localhost:5173', 'https://app.mirantus.com']
   */
  get corsOrigins(): string[] {
    const raw = this.config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  // ── Database connection pool ───────────────────────────────────────────────

  /** pg pool `max` connections.  Defaults to 10. */
  get dbPoolMax(): number {
    return this.config.get<number>('DB_POOL_MAX', 10);
  }

  /** pg pool `min` idle connections.  Defaults to 2. */
  get dbPoolMin(): number {
    return this.config.get<number>('DB_POOL_MIN', 2);
  }

  /**
   * Milliseconds before a connection attempt is abandoned.
   * Used by TypeORM DataSource and the /ready probe.  Defaults to 5000.
   */
  get dbConnectTimeoutMs(): number {
    return this.config.get<number>('DB_CONNECT_TIMEOUT_MS', 5000);
  }

  // ── Convenience flags ─────────────────────────────────────────────────────

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}
