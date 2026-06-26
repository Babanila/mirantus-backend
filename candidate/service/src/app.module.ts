import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
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
 *   T-14  → Global pipes + CORS   (main.ts)
 *   T-15  → APP_FILTER            (filters/)
 *   T-17  → APP_INTERCEPTOR       (ClassSerializerInterceptor)
 *   T-18  → HealthModule          (health/)
 *   T-19  → WinstonModule         (logger/)
 */
@Module({
  imports: [
    ConfigModule, // MUST be first for startup validation
    DatabaseModule, // Requires ConfigModule for DATABASE_URL
    OrdersModule, // Service layer (no controller yet)
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
