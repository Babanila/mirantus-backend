import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * T-18: Minimal health module
 * NO TypeOrmModule import needed - DataSource is globally available via DatabaseModule.forRoot
 * (TypeORM registers DataSource as application-wide provider when forRoot is used in root module)
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
