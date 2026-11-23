import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator.js';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rawResponse = this.reflector.getAllAndOverride<boolean>(
      RAW_RESPONSE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (rawResponse) return next.handle();
    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string }>();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      })),
    );
  }
}
