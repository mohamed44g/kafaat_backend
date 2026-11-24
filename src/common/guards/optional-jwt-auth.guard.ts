import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from '../../security/session.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  constructor(sessions: SessionService) {
    super(sessions);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.authorization) return true;
    return super.canActivate(context);
  }
}
