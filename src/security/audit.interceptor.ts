import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, tap, throwError, type Observable } from 'rxjs';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { AuditService } from './audit.service.js';
import { SessionService } from './session.service.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; id?: string }>();
    if (!this.shouldAudit(request)) return next.handle();
    const rawResourceId = Object.values(request.params ?? {})[0];
    const event = {
      actorUserId: request.user?.sub,
      action: `${request.method.toLowerCase()}.${request.path
        .replace(/^\/api\/v\d+\//, '')
        .replaceAll('/', '.')}`.slice(0, 120),
      resourceType: request.path
        .split('/')
        .filter(Boolean)
        .at(-2)
        ?.slice(0, 80),
      resourceId:
        typeof rawResourceId === 'string'
          ? rawResourceId.slice(0, 180)
          : undefined,
      requestId: request.id,
      ipHash: request.ip ? this.sessions.hash(request.ip) : undefined,
    };
    return next.handle().pipe(
      tap(() => void this.audit.record({ ...event, outcome: 'success' })),
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        void this.audit.record({
          ...event,
          outcome: status === 401 || status === 403 ? 'denied' : 'failed',
          metadata: { status },
        });
        return throwError(() => error);
      }),
    );
  }

  private shouldAudit(request: Request): boolean {
    if (request.path.includes('/admin/')) return true;
    if (request.path.includes('/auth/')) return true;
    return (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      (request.path.includes('/users/me') ||
        request.path.includes('/subscriptions/'))
    );
  }
}
