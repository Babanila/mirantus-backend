import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';

/**
 * T-19: Winston logger configuration with JSON formatting
 * CRITICAL SAFETY FEATURES:
 * - Silent in test environment (prevents test output pollution)
 * - LOG_LEVEL controlled by validated env var (T-02)
 * - JSON format with timestamp for log aggregation systems
 * - No console color codes (breaks JSON parsers)
 */
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => {
        const isTest = appConfig.isTest;
        const logLevel = appConfig.logLevel;

        return {
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                winston.format.errors({ stack: true }), // Include stack traces for errors
                winston.format.json(), // CRITICAL: Valid JSON for log aggregation
              ),
              silent: isTest, // Zero logs during tests (T-21/T-23 verification)
              level: logLevel,
            }),
          ],
          exceptionHandlers: [
            new winston.transports.Console({
              format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            }),
          ],
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
