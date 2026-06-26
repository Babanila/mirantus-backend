/**
 * main.ts — Application entry point
 *
 * SCAFFOLD (T-01): Minimal bootstrap that compiles and starts the server.
 *
 * COMPLETE WIRING (T-14) will add:
 *   • Global ValidationPipe  (whitelist + forbidNonWhitelisted + transform)
 *   • CORS                   (origin from CORS_ORIGIN env variable)
 *   • Request ID middleware  (X-Request-ID header on every response)
 *   • ConfigService port     (API_PORT env variable)
 *
 * Do not add those here — implement them in T-14 to keep changes atomic.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const port = parseInt(process.env['API_PORT'] ?? '3000', 10);
  await app.listen(port);
}

void bootstrap();
