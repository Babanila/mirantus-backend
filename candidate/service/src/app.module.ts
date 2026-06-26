import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

/**
 * AppModule — root NestJS module.
 *
 * This is the scaffold placeholder.  Modules are registered here as each
 * phase of TASKS.md is completed:
 *
 *   T-10  → OrdersModule          (orders/)
 *   T-14  → Global pipes + CORS   (main.ts)
 *   T-15  → APP_FILTER            (filters/)
 *   T-17  → APP_INTERCEPTOR       (ClassSerializerInterceptor)
 *   T-18  → HealthModule          (health/)
 *   T-19  → WinstonModule         (logger/)
 */
@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
