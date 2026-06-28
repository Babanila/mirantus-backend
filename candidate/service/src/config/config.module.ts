import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configSchema } from './config.schema';
import { AppConfigService } from './config.service';

const IS_TEST_ENV = process.env.NODE_ENV === 'test';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validationSchema: configSchema,
      validationOptions: {
        abortEarly: true, // Stop on first error for clear error messages
        allowUnknown: true, // Allow env vars not in schema (e.g., CI variables)
      },
      envFilePath: IS_TEST_ENV ? [] : ['.env.local', '.env'],
      isGlobal: true,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
