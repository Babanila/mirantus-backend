import {
  ClassSerializerInterceptor,
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';
import { OrdersModule } from './orders/orders.module';

/**
 * AppModule — root NestJS module.
 */
@Module({
  imports: [
    AppConfigModule, // MUST be first for startup validation
    DatabaseModule, // Requires AppConfigModule for DATABASE_URL
    OrdersModule, // Service layer (no controller yet)
    HealthModule, // Health endpoints
    LoggerModule, // Logging functionality
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CRITICAL ORDERING (after body parser, before routes):
    // 1. requestIdMiddleware (T-14) - sets X-Request-ID header
    // 2. RequestLoggingMiddleware (T-19) - uses requestId, measures duration
    consumer.apply(RequestLoggingMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL }); // Apply to ALL routes
  }
}
