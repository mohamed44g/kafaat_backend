import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum.js';
import { AppException } from '../../common/errors/app.exception.js';
import { DatabaseService } from '../../database/database.service.js';
import type { Video } from '../../database/entities/video.entity.js';
import type { BunnyWebhookDto } from './dto/bunny-stream.dto.js';
import { BunnyStreamService } from './bunny-stream.service.js';
interface WebhookSignatureHeaders {
  signature?: string;
  version?: string;
  algorithm?: string;
}
const videoFields = `id::text AS "id", title, description, is_free AS "isFree", position, duration_seconds AS "durationSeconds", bunny_video_id AS "bunnyVideoId", stream_status AS "streamStatus", thumbnail_url AS "thumbnailUrl", last_stream_event_at AS "lastStreamEventAt", course_id::text AS "courseId", created_at AS "createdAt", updated_at AS "updatedAt"`;
@Injectable()
export class BunnyWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly bunny: BunnyStreamService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BunnyWebhookService.name);
  }
  verify(rawBody: Buffer | undefined, headers: WebhookSignatureHeaders): void {
    const secret = this.config.get<string>('BUNNY_STREAM_READ_ONLY_API_KEY');
    if (
      !secret ||
      !rawBody ||
      headers.version !== 'v1' ||
      headers.algorithm !== 'hmac-sha256'
    )
      this.invalidSignature();
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supplied = headers.signature;
    if (
      !supplied ||
      !/^[0-9a-f]{64}$/.test(supplied) ||
      supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      this.invalidSignature();
  }
  async handle(event: BunnyWebhookDto): Promise<{ accepted: boolean }> {
    if (
      event.IsLiveStreamWebhook ||
      String(event.VideoLibraryId) !==
        this.config.get<string>('BUNNY_STREAM_LIBRARY_ID')
    )
      throw new AppException(
        ApiErrorCode.Forbidden,
        'Webhook does not belong to this video library',
        HttpStatus.FORBIDDEN,
      );
    const status = this.bunny.mapWebhookStatus(event.Status);
    const eventTime = new Date(event.Timestamp);
    const inserted = await this.db.transaction(async (db) => {
      const insert = await db.query(
        `INSERT INTO bunny_webhook_events (event_id,video_guid,status,event_timestamp) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_id`,
        [event.EventId, event.VideoGuid, event.Status, eventTime],
      );
      if (!insert.rowCount || !status) return false;
      await db.query(
        `UPDATE videos SET stream_status=$2,last_stream_event_at=$3,updated_at=now() WHERE bunny_video_id=$1 AND (last_stream_event_at IS NULL OR last_stream_event_at<$3)`,
        [event.VideoGuid, status, eventTime],
      );
      return true;
    });
    if (!inserted) return { accepted: true };
    this.logger.info(
      {
        eventId: event.EventId,
        videoId: event.VideoGuid,
        providerStatus: event.Status,
      },
      'Bunny Stream webhook accepted',
    );
    if (event.Status === 3 || event.Status === 4)
      void this.syncVideo(event.VideoGuid).catch((error: unknown) =>
        this.logger.error(
          { err: error, videoId: event.VideoGuid },
          'Could not synchronize completed Bunny video',
        ),
      );
    return { accepted: true };
  }
  async syncVideo(providerVideoId: string): Promise<Video | null> {
    const video = await this.db.oneOrNull<Video>(
      `SELECT ${videoFields} FROM videos WHERE bunny_video_id=$1`,
      [providerVideoId],
    );
    if (!video) {
      this.logger.warn(
        { videoId: providerVideoId },
        'Webhook referenced an unknown Bunny video',
      );
      return null;
    }
    const remote = await this.bunny.getVideo(providerVideoId);
    const updated = await this.db.oneOrNull<Video>(
      `UPDATE videos SET duration_seconds=$2,stream_status=$3,thumbnail_url=$4,updated_at=now() WHERE id=$1 RETURNING ${videoFields}`,
      [
        video.id,
        Math.max(0, remote.length ?? 0),
        this.bunny.mapApiStatus(remote.status),
        remote.thumbnailUrl ?? null,
      ],
    );
    await this.recalculateCourse(video.courseId);
    return updated;
  }
  @Cron('*/2 * * * *', { name: 'sync-pending-bunny-videos', timeZone: 'UTC' })
  async syncPendingVideos(): Promise<void> {
    const pending = await this.db.query<{ bunnyVideoId: string }>(
      `SELECT bunny_video_id AS "bunnyVideoId" FROM videos
       WHERE bunny_video_id IS NOT NULL
       AND stream_status IN ('not_uploaded', 'uploading', 'processing')
       ORDER BY updated_at ASC LIMIT 50`,
    );
    for (const video of pending.rows) {
      try {
        await this.syncVideo(video.bunnyVideoId);
      } catch (error) {
        this.logger.warn(
          { err: error, videoId: video.bunnyVideoId },
          'Could not poll Bunny video status',
        );
      }
    }
  }
  private async recalculateCourse(courseId: string) {
    await this.db.query(
      `UPDATE courses SET total_video=(SELECT COUNT(*) FROM videos WHERE course_id=$1),total_time=(SELECT COALESCE(SUM(duration_seconds),0) FROM videos WHERE course_id=$1) WHERE id=$1`,
      [courseId],
    );
  }
  private invalidSignature(): never {
    throw new AppException(
      ApiErrorCode.InvalidWebhookSignature,
      'Invalid webhook signature',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
