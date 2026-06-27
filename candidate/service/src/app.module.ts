import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';

/**
 * AppModule — root NestJS module.
 *
 * T-14: Minimal AppModule required for bootstrap
 * CRITICAL: Only includes modules required for app startup
 * - ConfigModule: Required for validation at bootstrap (T-02)
 * - DatabaseModule: Required for DataSource initialization (T-06)
 * - OrdersModule: Required for service layer (T-10-T-13)
 *
 * NOTE: HealthModule (T-18) and controllers (T-16) added later
 *
 * This is the scaffold placeholder.  Modules are registered here as each
 * phase of TASKS.md is completed:
 *
 *   T-17  → APP_INTERCEPTOR       (ClassSerializerInterceptor)
 *   T-18  → HealthModule          (health/)
 *   T-19  → WinstonModule         (logger/)
 */
@Module({
  imports: [
    ConfigModule, // MUST be first for startup validation
    DatabaseModule, // Requires ConfigModule for DATABASE_URL
    OrdersModule, // Service layer (no controller yet)
    HealthModule, // Health endpoints
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter, // T-15: Global exception filter
    },
    // T-17: GLOBAL RESPONSE SERIALIZATION
    // Enforces @Exclude/@Expose decorators on ALL responses
    // Critical for: field exclusion + ISO8601 UTC serialization
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}
