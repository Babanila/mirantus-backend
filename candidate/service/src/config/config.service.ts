/**
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

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get nodeEnv(): NodeEnv {
    return this.config.get<NodeEnv>('NODE_ENV', 'development');
  }

  get apiPort(): number {
    return this.config.get<number>('API_PORT', 3000);
  }

  get logLevel(): LogLevel {
    return this.config.get<LogLevel>('LOG_LEVEL', 'info');
  }

  get corsOrigins(): string[] {
    // Joi provides default ONLY if key is missing. If env var = "" (empty string), raw = ""
    const raw = this.config.get<string>('CORS_ORIGIN', 'http://localhost:5173');

    // Guard against empty string (common in misconfigured CI environments)
    if (!raw || raw.trim() === '') {
      return ['http://localhost:5173'];
    }

    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get dbPoolMax(): number {
    return this.config.get<number>('DB_POOL_MAX', 10);
  }

  get dbPoolMin(): number {
    return this.config.get<number>('DB_POOL_MIN', 2);
  }

  get dbConnectTimeoutMs(): number {
    return this.config.get<number>('DB_CONNECT_TIMEOUT_MS', 5000);
  }

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
