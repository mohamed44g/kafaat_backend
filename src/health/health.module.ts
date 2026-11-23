import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { MetricsService } from './metrics.service.js';

@Module({
  controllers: [HealthController],
  providers: [MetricsService, MetricsInterceptor],
  exports: [MetricsService, MetricsInterceptor],
})
export class HealthModule {}
