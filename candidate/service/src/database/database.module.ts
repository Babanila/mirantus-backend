import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';
import { OrderEntity } from '../orders/entities/order.entity';

/**
 * T-06: Database module with STRICT production-safe configuration
 *
 * Initialises TypeORM with a PostgreSQL DataSource using configuration
 * values from ConfigService (validated at startup by Joi schema in T-02).
 *
 * CRITICAL: synchronize MUST be false (never auto-generate schema)
 * Entities loaded via glob pattern to support migrations in dist/
 *
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule], // Required to inject AppConfigService
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => {
        return {
          type: 'postgres',
          url: appConfig.databaseUrl, // Typed as string (non-nullable per T-02)
          entities: [OrderEntity],
          synchronize: false,
          migrationsRun: false, // Migrations run explicitly via CLI (T-08 scripts)
          logging: ['development', 'test'].includes(appConfig.nodeEnv),
          extra: {
            max: appConfig.dbPoolMax,
            min: appConfig.dbPoolMin,
            connectionTimeoutMillis: appConfig.dbConnectTimeoutMs,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
