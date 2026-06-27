import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/**
 * T-19: Request-scoped logger with PII filtering
 * CRITICAL SAFETY FEATURES:
 * - Filters patientReference from log data at non-debug levels
 * - Injects requestId from request context (set by T-14 middleware)
 * - Safe for injection into services/controllers (though services don't log per architecture)
 */
@Injectable({ scope: Scope.REQUEST })
export class AppLoggerService {
  private readonly requestId: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(REQUEST) private readonly request: Request,
  ) {
    this.requestId = (request.headers['x-request-id'] as string) || 'unknown';

    // FAIL FAST: Validate logger shape at injection time
    if (typeof this.logger?.log !== 'function' || typeof this.logger?.info !== 'function') {
      throw new Error(
        '[AppLoggerService] CRITICAL: Injected logger lacks Winston methods. ' +
          'Verify WINSTON_MODULE_PROVIDER is used (not WINSTON_MODULE_NEST_PROVIDER).',
      );
    }
  }

  /**
   * Log with automatic PII filtering
   * @param level - Log level (info, warn, error, debug)
   * @param message - Log message
   * @param data - Structured data (patientReference filtered at non-debug levels)
   */
  private logWithFilter(level: string, message: string, data: Record<string, unknown> = {}) {
    // Winston's native .log() accepts level string directly
    const safeData = { ...data };

    if (typeof this.logger.info !== 'function') {
      throw new Error(
        'CRITICAL: Injected logger is not Winston raw logger. ' +
          'Did you use WINSTON_MODULE_PROVIDER? Check middleware/logger injection tokens.',
      );
    }

    if (level !== 'debug' && 'patientReference' in safeData) {
      delete safeData.patientReference;
      safeData._filteredFields = ['patientReference'];
    }

    this.logger.log(level, message, {
      // ← VALID FOR RAW WINSTON LOGGER
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      ...safeData,
    });
  }

  // Public methods map to Winston's native API
  log(message: string, data?: Record<string, unknown>) {
    this.logWithFilter('info', message, data); // Winston uses 'info' level
  }
  error(message: string, data?: Record<string, unknown>) {
    this.logWithFilter('error', message, data);
  }
  warn(message: string, data?: Record<string, unknown>) {
    this.logWithFilter('warn', message, data);
  }
  debug(message: string, data?: Record<string, unknown>) {
    this.logWithFilter('debug', message, data);
  }
  verbose(message: string, data?: Record<string, unknown>) {
    this.logWithFilter('verbose', message, data);
  }
}
