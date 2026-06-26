import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * T-14: Request ID middleware for distributed tracing
 * CRITICAL BEHAVIOR:
 * - Uses client-provided X-Request-ID if present (for upstream propagation)
 * - Generates new UUIDv4 if missing
 * - Sets X-Request-ID on ALL responses (including errors)
 * - Preserves original header value for logging correlation (T-19)
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prefer client-provided ID (for upstream tracing), else generate new
  const id = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();

  // Inject into request headers for downstream access (logging, etc.)
  req.headers['x-request-id'] = id;

  // Set response header BEFORE next() to ensure inclusion in ALL responses
  res.setHeader('X-Request-ID', id);

  next();
}
