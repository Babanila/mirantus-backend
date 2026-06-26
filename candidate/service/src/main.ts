import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { requestIdMiddleware } from './middleware/request-id.middleware';
// import { Logger } from 'winston'; // Placeholder for T-19 (no-op until Winston configured)

/**
 * main.ts — Application entry point
 *
 * T-14: Production bootstrap with strict security and observability foundations
 * CRITICAL CONFIGURATIONS (NON-NEGOTIABLE):
 * 1. forbidNonWhitelisted: true → Rejects unknown DTO fields (security boundary)
 * 2. CORS origins parsed from env (comma-separated)
 * 3. Request ID middleware applied BEFORE routes
 * 4. Port from ConfigService (validated via T-02 schema)
 */

async function bootstrap() {
  // Enable log buffering during startup (prevents log loss during init)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const appConfig = app.get(AppConfigService);

  // CRITICAL: Global ValidationPipe - SECURITY BOUNDARY
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-decorated properties
      forbidNonWhitelisted: true, // ←←← MOST CRITICAL SETTING (rejects unknown fields)
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: false, // Prevent unsafe type coercion
      },
      // Error response shape handled by GlobalExceptionFilter (T-15)
    }),
  );

  // CORS Configuration - From validated env variable
  const corsOrigins = appConfig.corsOrigins;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'],
  });

  // Global Middleware - Applied BEFORE routes
  app.use(requestIdMiddleware); // Sets X-Request-ID on all responses

  // Start Server - Port from validated config
  const port = appConfig.apiPort;
  await app.listen(port);

  // Optional: Log startup info (safe - no PII)
  if (process.env.NODE_ENV !== 'test') {
    console.log(`🚀 Screening Order Service listening on port ${port}`);
    console.log(`🌍 Environment: ${appConfig.nodeEnv}`);
    console.log(`🔒 CORS allowed origins: ${corsOrigins.join(', ')}`);
  }
}

void bootstrap().catch((error) => {
  console.error('❌ Application bootstrap failed:', error);
  process.exit(1);
});
