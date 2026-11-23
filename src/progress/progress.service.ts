import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { ApiErrorCode } from '../common/errors/api-error-code.enum.js';
import { DatabaseService } from '../database/database.service.js';
import type { UserVideoProgress } from '../database/entities/user-video-progress.entity.js';

@Injectable()
export class ProgressService {
  constructor(private readonly db: DatabaseService) {}
  async update(userId: string, videoId: string, watchedDuration: number) {
    const video = await this.db.oneOrNull<{ durationSeconds: number }>(
      `SELECT duration_seconds AS "durationSeconds" FROM videos WHERE id=$1`,
      [videoId],
    );
    if (!video)
      throw new AppException(
        ApiErrorCode.ResourceNotFound,
        'Video not found',
        HttpStatus.NOT_FOUND,
      );
    const normalized = Math.min(
      watchedDuration,
      video.durationSeconds || watchedDuration,
    );
    const completed =
      video.durationSeconds > 0 && normalized / video.durationSeconds >= 0.9;
    return this.db.oneOrNull<UserVideoProgress>(
      `INSERT INTO user_video_progress (user_id,video_id,watched_duration,is_completed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,video_id) DO UPDATE SET watched_duration=GREATEST(user_video_progress.watched_duration,EXCLUDED.watched_duration), is_completed=user_video_progress.is_completed OR EXCLUDED.is_completed, updated_at=now() RETURNING id::text AS "id",user_id::text AS "userId",video_id::text AS "videoId",is_completed AS "isCompleted",watched_duration AS "watchedDuration",updated_at AS "updatedAt"`,
      [userId, videoId, normalized, completed],
    );
  }
  async courseProgress(userId: string, courseId: string) {
    const result = await this.db.oneOrNull<{
      total: number;
      completed: number;
    }>(
      `SELECT (SELECT count(*)::int FROM videos WHERE course_id=$2) AS total, (SELECT count(*)::int FROM user_video_progress p JOIN videos v ON v.id=p.video_id WHERE p.user_id=$1 AND v.course_id=$2 AND p.is_completed=true) AS completed`,
      [userId, courseId],
    );
    const total = result?.total ?? 0;
    const completed = result?.completed ?? 0;
    return {
      courseId,
      completedVideos: completed,
      totalVideos: total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }
}
