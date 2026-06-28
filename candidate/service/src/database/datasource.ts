import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

/**
 * Standalone DataSource for TypeORM CLI usage.
 *
 * This is NOT the application DataSource — it is used exclusively by:
 * - npm run migration:generate
 * - npm run migration:run
 * - npm run migration:revert
 *
 * It reads directly from process.env after loading .env via dotenv,
 * bypassing the NestJS AppConfigModule and Joi validation intentionally —
 * the CLI context has no NestJS container.
 *
 * Usage:
 *   npm run migration:run
 *   npm run migration:generate -- --name=CreateOrdersTable
 */
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    '[datasource.ts] DATABASE_URL environment variable is required. ' +
      'Copy .env.example to .env and set a valid PostgreSQL connection string.',
  );
}

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  logging: process.env.NODE_ENV === 'development',
});
