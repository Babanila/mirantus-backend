import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { requestIdMiddleware } from '../src/middleware/request-id.middleware';

export async function createTestingApp(): Promise<INestApplication> {
  // Verify critical env vars exist BEFORE module compilation
  const requiredVars = ['DATABASE_URL', 'NODE_ENV'] as const;
  const missingVars = requiredVars.filter((v) => !process.env[v]);

  if (missingVars.length > 0) {
    throw new Error(
      `[TEST SETUP] CRITICAL: Missing environment variables required by AppConfigModule:\n` +
        `  Missing: ${missingVars.join(', ')}\n` +
        `  Solution: Ensure vitest.config.ts has 'test.env' with ALL required vars.\n` +
        `  Current NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`,
    );
  }

  try {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: false,
        },
      }),
    );

    await app.init();

    return app;
  } catch (error) {
    // 🚨 SURFACE CONFIGURATION ERRORS EXPLICITLY
    if (error instanceof Error && error.message.includes('Config validation error')) {
      throw new Error(
        `[TEST SETUP] CONFIG VALIDATION FAILED\n` +
          `This means required env vars are missing or invalid.\n` +
          `Check vitest.config.ts 'test.env' contains ALL values from config.schema.ts\n` +
          `Raw error: ${error.message}`,
      );
    }
    throw error;
  }
}
