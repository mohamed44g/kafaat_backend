import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../common/errors/api-error-code.enum.js';
import { AppException } from '../common/errors/app.exception.js';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { DatabaseService } from '../database/database.service.js';
import { JitsiService } from '../integrations/jitsi/jitsi.service.js';
import { UserRole } from '../users/entities/user.entity.js';
import type {
  CreateLiveSessionDto,
  UpdateLiveSessionDto,
} from './dto/live-session.dto.js';

export interface LiveSessionRow {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  durationMinutes: number;
  status: 'scheduled' | 'live' | 'ended' | 'canceled' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

interface InternalLiveSessionRow extends LiveSessionRow {
  jitsiRoomName: string;
  createdBy: string;
}

const computedStatus = `CASE
  WHEN status IN ('canceled', 'failed') THEN status
  WHEN now() >= starts_at + make_interval(mins => duration_minutes) THEN 'ended'
  WHEN now() >= starts_at THEN 'live'
  ELSE 'scheduled'
END`;

const publicFields = `
  id::text AS "id", title, description, starts_at AS "startsAt",
  duration_minutes AS "durationMinutes", ${computedStatus} AS status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

const internalFields = `${publicFields},
  jitsi_room_name AS "jitsiRoomName", created_by::text AS "createdBy"`;

@Injectable()
export class LiveSessionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jitsi: JitsiService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LiveSessionsService.name);
  }

  async listUpcoming(): Promise<LiveSessionRow[]> {
    return (
      await this.db.query<LiveSessionRow>(
        `SELECT ${publicFields} FROM live_sessions
         WHERE status NOT IN ('canceled', 'failed')
         AND starts_at + make_interval(mins => duration_minutes + 30) >= now()
         ORDER BY starts_at ASC LIMIT 50`,
      )
    ).rows;
  }

  async listAdmin(): Promise<LiveSessionRow[]> {
    return (
      await this.db.query<LiveSessionRow>(
        `SELECT ${publicFields} FROM live_sessions
         ORDER BY starts_at DESC LIMIT 200`,
      )
    ).rows;
  }

  async create(
    input: CreateLiveSessionDto,
    createdBy: string,
  ): Promise<LiveSessionRow> {
    this.assertFutureDate(input.startsAt);
    const result = await this.db.query<LiveSessionRow>(
      `INSERT INTO live_sessions
       (title, description, starts_at, duration_minutes, jitsi_room_name,
        recording_enabled, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING ${publicFields}`,
      [
        input.title.trim(),
        input.description?.trim() || null,
        new Date(input.startsAt),
        input.durationMinutes,
        this.createRoomName(),
        false,
        createdBy,
      ],
    );
    this.logger.info(
      { liveSessionId: result.rows[0]!.id },
      'Jitsi live session created',
    );
    return result.rows[0]!;
  }

  async update(
    id: string,
    input: UpdateLiveSessionDto,
  ): Promise<LiveSessionRow> {
    const current = await this.getAdmin(id);
    if (current.status === 'ended' || current.status === 'canceled')
      throw new BadRequestException('Ended or canceled sessions cannot be edited');
    const merged: CreateLiveSessionDto = {
      title: input.title ?? current.title,
      description: input.description ?? current.description ?? undefined,
      startsAt: input.startsAt ?? current.startsAt.toISOString(),
      durationMinutes: input.durationMinutes ?? current.durationMinutes,
    };
    this.assertFutureDate(merged.startsAt);
    const result = await this.db.query<LiveSessionRow>(
      `UPDATE live_sessions SET title=$2, description=$3, starts_at=$4,
       duration_minutes=$5, recording_enabled=false, updated_at=now()
       WHERE id=$1 RETURNING ${publicFields}`,
      [
        id,
        merged.title.trim(),
        merged.description?.trim() || null,
        new Date(merged.startsAt),
        merged.durationMinutes,
      ],
    );
    return result.rows[0]!;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.getAdmin(id);
    await this.db.query('DELETE FROM live_sessions WHERE id=$1', [id]);
    this.logger.info({ liveSessionId: id }, 'Jitsi live session deleted');
    return { deleted: true };
  }

  async getJoinConfig(user: AuthUser, sessionId: string) {
    const session = await this.getAdmin(sessionId);
    const isModerator = [UserRole.Admin, UserRole.SuperAdmin].includes(user.role);
    const now = Date.now();
    const startsAt = session.startsAt.getTime();
    const closesAt = startsAt + (session.durationMinutes + 30) * 60_000;
    const opensAt = startsAt - 15 * 60_000;
    if (
      session.status === 'canceled' ||
      session.status === 'failed' ||
      session.status === 'ended' ||
      (!isModerator && (now < opensAt || now > closesAt))
    )
      throw new AppException(
        ApiErrorCode.LiveSessionNotAvailable,
        now < opensAt
          ? 'The session opens 15 minutes before its scheduled time'
          : 'The session is no longer available',
        HttpStatus.CONFLICT,
      );

    if (!isModerator) await this.requireEntitlement(user.sub);
    const profile = await this.db.oneOrNull<{ name: string; email: string }>(
      'SELECT name, email FROM users WHERE id=$1',
      [user.sub],
    );
    if (!profile)
      throw new AppException(
        ApiErrorCode.ResourceNotFound,
        'User not found',
        HttpStatus.NOT_FOUND,
      );

    return {
      session: {
        id: session.id,
        title: session.title,
        startsAt: session.startsAt,
        durationMinutes: session.durationMinutes,
      },
      ...this.jitsi.createJoinConfig({
        roomName: session.jitsiRoomName,
        userId: user.sub,
        userName: profile.name,
        userEmail: profile.email,
        isModerator,
      }),
    };
  }

  @Cron('0 * * * * *', { name: 'sync-live-session-status', timeZone: 'UTC' })
  async syncStatuses(): Promise<void> {
    const result = await this.db.query(
      `UPDATE live_sessions SET
       status = CASE
         WHEN now() >= starts_at + make_interval(mins => duration_minutes)
           THEN 'ended'
         WHEN now() >= starts_at THEN 'live'
         ELSE 'scheduled'
       END,
       updated_at = now()
       WHERE status IN ('scheduled', 'live')
       AND status <> CASE
         WHEN now() >= starts_at + make_interval(mins => duration_minutes)
           THEN 'ended'
         WHEN now() >= starts_at THEN 'live'
         ELSE 'scheduled'
       END`,
    );
    if (result.rowCount)
      this.logger.info(
        { updatedSessions: result.rowCount },
        'Live session statuses updated',
      );
  }

  private async getAdmin(id: string): Promise<InternalLiveSessionRow> {
    const session = await this.db.oneOrNull<InternalLiveSessionRow>(
      `SELECT ${internalFields} FROM live_sessions WHERE id=$1`,
      [id],
    );
    if (!session)
      throw new AppException(
        ApiErrorCode.ResourceNotFound,
        'Live session not found',
        HttpStatus.NOT_FOUND,
      );
    return session;
  }

  private async requireEntitlement(userId: string): Promise<void> {
    const entitlement = await this.db.oneOrNull<{ allowed: boolean }>(
      `SELECT true AS allowed FROM subscriptions s
       JOIN subscription_plan_features f ON f.plan_id=s.plan_id
       WHERE s.user_id=$1 AND s.status='active'
       AND s.starts_at <= now() AND s.end_at > now()
       AND f.feature_key='online_sessions' LIMIT 1`,
      [userId],
    );
    if (!entitlement?.allowed)
      throw new AppException(
        ApiErrorCode.SubscriptionRequired,
        'A Premium subscription is required for online sessions',
        HttpStatus.PAYMENT_REQUIRED,
      );
  }

  private createRoomName(): string {
    return `kafaat-${randomUUID().replaceAll('-', '')}`;
  }

  private assertFutureDate(value: string): void {
    const startsAt = new Date(value);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now())
      throw new BadRequestException('startsAt must be a future date');
  }
}
