/**
 * config.schema.ts
 *
 * Joi validation schema for all environment variables.
 *
 * Authority: TASKS.md T-02 / SPEC.md §13.
 * The service will REFUSE TO START if any required variable is absent or
 * if any variable fails its type/range constraint.  All errors are surfaced
 * at once (abortEarly: false) so misconfigured deployments are diagnosed in
 * a single boot cycle.
 *
 * ⚠  Do NOT add variables here without a corresponding entry in .env.example
 *    and in AppConfigService (config.service.ts).
 */

import * as Joi from 'joi';

export const configSchema = Joi.object({
  // ── Database ───────────────────────────────────────────────────────────────
  // REQUIRED.  Must be a valid postgresql:// or postgres:// URI.
  // The service cannot function without a database connection; failing fast here
  // prevents a cryptic TypeORM error deep in the boot sequence.
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  // ── Runtime ────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

  // Port must be in the unprivileged range — no need to run as root.
  API_PORT: Joi.number().integer().min(1024).max(65535).default(3000),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  // ── CORS ───────────────────────────────────────────────────────────────────
  // Comma-separated list of allowed origins.
  // AppConfigService.corsOrigins splits and trims this into string[].
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  // ── Database connection pool ────────────────────────────────────────────────
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),

  DB_POOL_MIN: Joi.number().integer().min(1).default(2),

  // Milliseconds.  Used by the TypeORM DataSource and the /ready probe.
  DB_CONNECT_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
});
