import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';

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
      imports: [ConfigModule], // Required to inject AppConfigService
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        type: 'postgres',
        url: appConfig.databaseUrl, // Typed as string (non-nullable per T-02)
        entities: [__dirname + '/../**/*.entity{.ts,.js}'], // Glob pattern for src/dist compatibility
        synchronize: false, // 🚨 NEVER true - migrations ONLY for schema changes
        migrationsRun: false, // Migrations run explicitly via CLI (T-08 scripts)
        logging: appConfig.nodeEnv === 'development',
        extra: {
          max: appConfig.dbPoolMax,
          min: appConfig.dbPoolMin,
          connectionTimeoutMillis: appConfig.dbConnectTimeoutMs,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
