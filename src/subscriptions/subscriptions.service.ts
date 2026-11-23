import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../common/errors/api-error-code.enum.js';
import { AppException } from '../common/errors/app.exception.js';
import { DatabaseService } from '../database/database.service.js';
import type { SubscriptionPlan } from '../database/entities/subscription-plan.entity.js';
import {
  Subscription,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../database/entities/subscription.entity.js';
import { UsersService } from '../users/users.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import {
  CreatePlanFeatureDto,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto.js';

const planFields = `
  p.id::text AS "id", p.name, p.slug, p.description,
  p.price::text AS "price", p.currency,
  p.duration_months AS "durationMonths", p.is_active AS "isActive",
  p.created_at AS "createdAt", p.updated_at AS "updatedAt",
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'id', f.id::text, 'planId', f.plan_id::text,
      'featureKey', f.feature_key, 'label', f.label,
      'createdAt', f.created_at
    ) ORDER BY f.id)
    FROM subscription_plan_features f WHERE f.plan_id = p.id),
    '[]'::jsonb
  ) AS features`;

const subscriptionFields = `
  s.id::text AS "id", s.user_id::text AS "userId",
  s.plan_id::text AS "planId", s.status,
  s.starts_at AS "startsAt", s.end_at AS "endAt",
  s.provider, s.created_at AS "createdAt"`;
const subscriptionReturningFields = `
  id::text AS "id", user_id::text AS "userId",
  plan_id::text AS "planId", status,
  starts_at AS "startsAt", end_at AS "endAt",
  provider, created_at AS "createdAt"`;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly users: UsersService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SubscriptionsService.name);
  }

  async listPlans(activeOnly = true): Promise<SubscriptionPlan[]> {
    const result = await this.db.query<SubscriptionPlan>(
      `SELECT ${planFields} FROM subscription_plans p
       ${activeOnly ? 'WHERE p.is_active = true' : ''}
       ORDER BY p.price ASC, p.created_at ASC`,
    );
    return result.rows;
  }

  async createPlan(
    input: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO subscription_plans
       (name, slug, description, price, currency, duration_months, is_active)
       VALUES ($1, $2, $3, $4, 'KWD', $5, $6)
       RETURNING id::text AS "id"`,
      [
        input.name,
        input.slug,
        input.description,
        input.price,
        input.durationMonths,
        input.isActive ?? true,
      ],
    );
    return this.getPlan(result.rows[0]!.id);
  }

  async updatePlan(
    id: string,
    input: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE subscription_plans SET
       name = COALESCE($2, name), slug = COALESCE($3, slug),
       description = COALESCE($4, description),
       price = COALESCE($5, price),
       duration_months = COALESCE($6, duration_months),
       is_active = COALESCE($7, is_active), updated_at = now()
       WHERE id = $1 RETURNING id::text AS "id"`,
      [
        id,
        input.name ?? null,
        input.slug ?? null,
        input.description ?? null,
        input.price ?? null,
        input.durationMonths ?? null,
        input.isActive ?? null,
      ],
    );
    if (!result.rows[0]) this.planNotFound();
    return this.getPlan(id);
  }

  async removePlan(id: string): Promise<{ deleted: true }> {
    const result = await this.db.query(
      'DELETE FROM subscription_plans WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rowCount) this.planNotFound();
    return { deleted: true };
  }

  async addFeature(
    planId: string,
    input: CreatePlanFeatureDto,
  ): Promise<SubscriptionPlan> {
    await this.getPlan(planId);
    await this.db.query(
      `INSERT INTO subscription_plan_features (plan_id, feature_key, label)
       VALUES ($1, $2, $3)`,
      [planId, input.featureKey, input.label],
    );
    return this.getPlan(planId);
  }

  async removeFeature(
    planId: string,
    featureId: string,
  ): Promise<{ deleted: true }> {
    const result = await this.db.query(
      `DELETE FROM subscription_plan_features
       WHERE id = $1 AND plan_id = $2 RETURNING id`,
      [featureId, planId],
    );
    if (!result.rowCount)
      throw new AppException(
        ApiErrorCode.ResourceNotFound,
        'Plan feature not found',
        HttpStatus.NOT_FOUND,
      );
    return { deleted: true };
  }

  async getCurrent(userId: string) {
    const subscription = await this.db.oneOrNull<
      Subscription & { plan: SubscriptionPlan }
    >(
      `SELECT ${subscriptionFields},
       jsonb_build_object(
         'id', p.id::text, 'name', p.name, 'slug', p.slug,
         'description', p.description, 'price', p.price::text,
         'currency', p.currency, 'durationMonths', p.duration_months,
         'isActive', p.is_active,
         'features', COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id', f.id::text, 'planId', f.plan_id::text,
           'featureKey', f.feature_key, 'label', f.label,
           'createdAt', f.created_at
         ) ORDER BY f.id) FROM subscription_plan_features f
         WHERE f.plan_id = p.id), '[]'::jsonb)
       ) AS plan
       FROM subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 ORDER BY s.end_at DESC LIMIT 1`,
      [userId],
    );
    return {
      isSubscribed: Boolean(
        subscription?.status === SubscriptionStatus.Active &&
        subscription.endAt > new Date(),
      ),
      subscription,
    };
  }

  async create(input: CreateSubscriptionDto) {
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    if (Number.isNaN(startsAt.getTime()))
      throw new BadRequestException('Invalid startsAt');
    await this.users.findById(input.userId);
    const plan = await this.getPlan(input.planId);
    if (!plan.isActive)
      throw new BadRequestException('Subscription plan is inactive');
    const endAt = new Date(startsAt);
    endAt.setUTCMonth(endAt.getUTCMonth() + plan.durationMonths);

    return this.db.transaction(async (db) => {
      await db.query(
        `UPDATE subscriptions SET status = 'canceled'
         WHERE user_id = $1 AND status = 'active'`,
        [input.userId],
      );
      const created = await db.query<Subscription>(
        `INSERT INTO subscriptions
         (user_id, plan_id, status, starts_at, end_at, provider)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${subscriptionReturningFields}`,
        [
          input.userId,
          input.planId,
          SubscriptionStatus.Active,
          startsAt,
          endAt,
          input.provider ?? SubscriptionProvider.Card,
        ],
      );
      await db.query(
        `UPDATE users SET is_subscribed = true,
         subscription_ends_at = $2, updated_at = now() WHERE id = $1`,
        [input.userId, endAt],
      );
      return { ...created.rows[0]!, plan };
    });
  }

  @Cron('0 0 * * *', { name: 'expire-subscriptions', timeZone: 'UTC' })
  async expireSubscriptions(): Promise<void> {
    const expired = await this.db.transaction(async (db) => {
      const result = await db.query<{ userId: string }>(
        `UPDATE subscriptions SET status = 'expired'
         WHERE status = 'active' AND end_at < now()
         RETURNING user_id::text AS "userId"`,
      );
      if (result.rows.length)
        await db.query(
          `UPDATE users u SET is_subscribed = false,
           subscription_ends_at = NULL, updated_at = now()
           WHERE u.id = ANY($1::bigint[])
           AND NOT EXISTS (SELECT 1 FROM subscriptions s
             WHERE s.user_id = u.id AND s.status = 'active'
             AND s.end_at >= now())`,
          [result.rows.map((row) => row.userId)],
        );
      return result.rows.length;
    });
    this.logger.info(
      { expiredSubscriptions: expired },
      'Subscription expiration job completed',
    );
  }

  private async getPlan(id: string): Promise<SubscriptionPlan> {
    const plan = await this.db.oneOrNull<SubscriptionPlan>(
      `SELECT ${planFields} FROM subscription_plans p WHERE p.id = $1`,
      [id],
    );
    if (!plan) this.planNotFound();
    return plan;
  }

  private planNotFound(): never {
    throw new AppException(
      ApiErrorCode.ResourceNotFound,
      'Subscription plan not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
