import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';

/**
 * T-15: Global exception handler enforcing SPEC.md §10 frozen error schema
 * CRITICAL REQUIREMENTS:
 * - NEVER include NestJS default fields (error, stack)
 * - Validation errors transformed to { field, message }[] format
 * - Timestamp ALWAYS ISO8601 UTC (new Date().toISOString())
 * - Path includes full URL path (req.url)
 * - Raw errors NEVER leak internal details (security)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // Determine status code (default 500 for non-HttpException)
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let errors: Array<{ field: string; message: string }> | undefined;

    // Process HttpException details
    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      // Handle string responses (e.g., NotFoundException default)
      if (typeof body === 'string') {
        message = body;
      }
      // Handle object responses (ValidationPipe, custom exceptions)
      else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;

        // Extract primary message (fallback to default if missing)
        if (typeof b.message === 'string') {
          message = b.message;
        } else if (Array.isArray(b.message)) {
          // SPECIAL HANDLING: ValidationPipe produces { message: string[] }
          message = 'Validation failed';
          errors = (b.message as string[]).map((m) => {
            // Extract field name: first word before space (e.g., "partnerId must be a string" → "partnerId")
            const field = m.split(' ')[0]?.replace(/[^a-zA-Z0-9_]/g, '') || 'unknown';
            return { field, message: m };
          });
        }

        // Fallback: Use 'error' field if present (NestJS default format)
        if (!message && typeof b.error === 'string') {
          message = b.error;
        }
      }
    }
    // SECURITY: Raw errors NEVER expose details (only generic message)
    // Stack traces logged separately in T-19 structured logging

    // BUILD FROZEN RESPONSE (SPEC.md §10 - NO DEVIATIONS)
    res.status(status).json({
      statusCode: status,
      message,
      ...(errors ? { errors } : {}), // Only include if populated
      timestamp: new Date().toISOString(), // ISO8601 UTC (ends with Z)
      path: req.url,
    });
  }
}
