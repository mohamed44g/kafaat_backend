import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, type Observable } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    return next.handle().pipe(
      finalize(() => {
        const route = request.route?.path?.toString() ?? 'unmatched';
        const labels = {
          method: request.method,
          route,
          status: String(response.statusCode),
        };
        const seconds =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        this.metrics.requestCount.inc(labels);
        this.metrics.requestDuration.observe(labels, seconds);
      }),
    );
  }
}
