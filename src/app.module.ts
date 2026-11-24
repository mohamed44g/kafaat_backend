import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AuthModule } from './auth/auth.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { validateEnvironment } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { ContentModule } from './content/content.module.js';
import { HealthModule } from './health/health.module.js';
import { SecurityModule } from './security/security.module.js';
import { AuditInterceptor } from './security/audit.interceptor.js';
import { UsersModule } from './users/users.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { BankTransferModule } from './bank-transfer/bank-transfer.module.js';
import { LiveSessionsModule } from './live-sessions/live-sessions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (request, response) => {
          const id =
            request.headers['x-request-id']?.toString() ?? randomUUID();
          response.setHeader('x-request-id', id);
          return id;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.accesskey',
            'req.headers.x-bunnystream-signature',
            'req.body.password',
            'req.body.code',
            'req.body.challengeToken',
            'passwordHash',
            'mfaSecretEncrypted',
            'jwt',
            'apiKey',
            'req.body.password',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    SecurityModule,
    DatabaseModule,
    ContentModule,
    AuthModule,
    UsersModule,
    HealthModule,
    SubscriptionsModule,
    ProgressModule,
    BankTransferModule,
    LiveSessionsModule,
  ],
  providers: [
    GlobalExceptionFilter,
    ResponseInterceptor,
    AuditInterceptor,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
