import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseService } from '../database/database.service.js';
import { MetricsService } from './metrics.service.js';
import { RawResponse } from '../common/decorators/raw-response.decorator.js';
import { MetricsAuthGuard } from './metrics-auth.guard.js';

@ApiTags('health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health/live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe including PostgreSQL' })
  async ready() {
    try {
      await this.database.query('SELECT 1');
      return { status: 'ok', checks: { database: 'up' } };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Service is not ready',
        details: { database: 'down' },
      });
    }
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @RawResponse()
  @ApiExcludeEndpoint()
  @UseGuards(MetricsAuthGuard)
  metricsEndpoint() {
    return this.metrics.registry.metrics();
  }
}
