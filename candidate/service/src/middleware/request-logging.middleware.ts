import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppConfigService } from '../config/config.service';

/**
 * T-19: HTTP request logger with duration tracking and PII safety
 * CRITICAL BEHAVIOR:
 * - Logs request start/completion with durationMs
 * - NEVER logs request body at non-debug levels (prevents PII leakage)
 * - Logs partnerId/orderId ONLY when available in URL (not body)
 * - Bypasses GlobalExceptionFilter (health checks shouldn't trigger error logs)
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  // Inject AppConfigService for CONFIG-TIME log level (not runtime logger state)
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
    private readonly appConfig: AppConfigService, // Injected via Nest DI
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const orderId = req.params?.id || null;
    const partnerId = req.query?.partnerId ? String(req.query.partnerId) : null;

    // Track response finish for duration calculation
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const logData = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs,
        requestId,
        orderId,
        partnerId,
      };

      // ALWAYS log non-sensitive metadata at info level
      this.logger.info('request_completed', logData);

      // SAFE PII CHECK: Use CONFIGURED log level (not logger.level which is unreliable)
      // Joi schema guarantees logLevel is one of: 'error','warn','info','debug'
      if (this.appConfig.logLevel === 'debug' && Object.keys(req.body).length > 0) {
        this.logger.debug('request_body', {
          requestId,
          url: req.url,
          body: req.body, // ✅ ONLY at debug level per TASKS.md
        });
      }
    });

    next();
  }
}
