import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('METRICS_TOKEN') ?? '';
    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : '';
    const left = Buffer.from(expected);
    const right = Buffer.from(supplied);
    if (
      left.length >= 32 &&
      left.length === right.length &&
      timingSafeEqual(left, right)
    )
      return true;
    throw new UnauthorizedException('Metrics credentials are required');
  }
}
