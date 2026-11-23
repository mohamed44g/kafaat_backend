import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { ApiErrorCode } from '../errors/api-error-code.enum.js';
import { AppException } from '../errors/app.exception.js';
import type { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; params: { videoId: string } }>();
    const video = await this.db.oneOrNull<{ isFree: boolean }>(
      `SELECT is_free AS "isFree" FROM videos WHERE id=$1`,
      [request.params.videoId],
    );
    if (!video)
      throw new AppException(
        ApiErrorCode.ResourceNotFound,
        'Video not found',
        HttpStatus.NOT_FOUND,
      );
    if (video.isFree) return true;
    if (!request.user)
      throw new AppException(
        ApiErrorCode.Unauthorized,
        'Authentication is required',
        HttpStatus.UNAUTHORIZED,
      );
    const entitlement = await this.db.oneOrNull<{ allowed: boolean }>(
      `SELECT true AS allowed
       FROM subscriptions s
       JOIN subscription_plan_features f ON f.plan_id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active'
       AND s.starts_at <= now() AND s.end_at > now()
       AND f.feature_key = 'all_content' LIMIT 1`,
      [request.user.sub],
    );
    if (entitlement?.allowed) return true;
    throw new AppException(
      ApiErrorCode.SubscriptionRequired,
      'An active subscription is required',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
