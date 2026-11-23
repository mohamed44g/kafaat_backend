import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly requestCount = new Counter({
    name: 'kafaat_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });
  readonly requestDuration = new Histogram({
    name: 'kafaat_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'kafaat-api' });
    collectDefaultMetrics({ register: this.registry, prefix: 'kafaat_' });
  }
}
