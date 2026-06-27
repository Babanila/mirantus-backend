import { Controller, Get, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Response } from 'express';

/**
 * T-18: Health endpoints for infrastructure monitoring
 * CRITICAL BEHAVIOR:
 * - /health: Zero dependencies (never queries DB, never fails except process crash)
 * - /ready: Explicit DB connectivity check (returns 503 on failure)
 * - ALL responses include ISO8601 UTC timestamp
 * - Uses @Res() WITHOUT passthrough (health endpoints bypass interceptors intentionally)
 */
@Controller()
export class HealthController {
  // DataSource injection safe because DatabaseModule is imported in AppModule root context
  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /health - LIVENESS PROBE
   * Kubernetes/docker-compose uses this to determine if process is alive
   * MUST NEVER query database or external dependencies
   */
  @Get('health')
  health(@Res() res: Response) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(), // ISO8601 UTC
    });
  }

  /**
   * GET /ready - READINESS PROBE
   * Kubernetes/docker-compose uses this to determine if traffic should be routed
   * Returns 503 when database is unreachable (critical for zero-downtime deployments)
   */
  @Get('ready')
  async ready(@Res() res: Response) {
    try {
      // Lightweight connectivity check (does NOT verify schema/migrations)
      await this.dataSource.query('SELECT 1');

      res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(), // ISO8601 UTC
      });
    } catch (error) {
      // CRITICAL: Return 503 on ANY database error (connection, auth, timeout)
      res.status(503).json({
        status: 'not_ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(), // ISO8601 UTC
        // NOTE: Error details intentionally omitted (security best practice)
      });
    }
  }
}
