import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as winston from 'winston';
import { AppConfigService } from '../config/config.service';

// CRITICAL: Standalone Winston logger instance (created ONCE at module load)
const requestLogger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      // Get log level directly from process.env (matches LoggerModule config)
      level: process.env.LOG_LEVEL || 'info',
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  // AppConfigService ONLY for config values (NOT logger injection)
  constructor(private readonly appConfig: AppConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const orderId = req.params?.id || null;
    const partnerId = req.query?.partnerId ? String(req.query.partnerId) : null;

    // Track response completion
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;

      // ALWAYS log metadata at info level (safe fields only)
      requestLogger.info('request_completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs,
        requestId,
        orderId,
        partnerId,
      });

      // ONLY log body at debug level (PII safety)
      if (this.appConfig.logLevel === 'debug' && Object.keys(req.body).length > 0) {
        requestLogger.debug('request_body', {
          requestId,
          url: req.url,
          body: req.body,
        });
      }
    });

    next();
  }
}
