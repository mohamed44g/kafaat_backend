import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error-code.enum.js';
import { AppException } from '../common/errors/app.exception.js';
import { DatabaseService } from '../database/database.service.js';
import type { Category } from '../database/entities/category.entity.js';
import type { Course } from '../database/entities/course.entity.js';
import type { Instructor } from '../database/entities/instructor.entity.js';
import type { Video } from '../database/entities/video.entity.js';
import { BunnyStreamService } from '../integrations/bunny-stream/bunny-stream.service.js';
import { BunnyWebhookService } from '../integrations/bunny-stream/bunny-webhook.service.js';
import { StreamStatus } from '../integrations/bunny-stream/bunny-stream.types.js';
import type { CreateVideoUploadSessionDto } from '../integrations/bunny-stream/dto/bunny-stream.dto.js';
import {
  CreateCategoryDto,
  CreateCourseDto,
  CreateInstructorDto,
  CreateVideoDto,
  UpdateCategoryDto,
  UpdateCourseDto,
  UpdateInstructorDto,
  UpdateVideoDto,
} from './dto/content.dto.js';

const categoryFields = `id::text AS "id", title, created_at AS "createdAt"`;
const instructorFields = `id::text AS "id", name, bio, avatar_url AS "avatarUrl", created_at AS "createdAt"`;
const videoFields = `id::text AS "id", title, description, is_free AS "isFree", position, duration_seconds AS "durationSeconds", bunny_video_id AS "bunnyVideoId", stream_status AS "streamStatus", thumbnail_url AS "thumbnailUrl", last_stream_event_at AS "lastStreamEventAt", course_id::text AS "courseId", created_at AS "createdAt", updated_at AS "updatedAt"`;
const courseFields = `c.id::text AS "id", c.slug, c.title, c.description, c.thumbnail_url AS "thumbnailUrl", c.total_time::text AS "totalTime", c.total_video AS "totalVideo", c.is_published AS "isPublished", c.instructor_id::text AS "instructorId", c.category_id::text AS "categoryId", c.created_at AS "createdAt"`;

@Injectable()
export class ContentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly bunny: BunnyStreamService,
    private readonly bunnyWebhooks: BunnyWebhookService,
  ) {}

  async listCategories(): Promise<Category[]> {
    return (
      await this.db.query<Category>(
        `SELECT ${categoryFields} FROM categories ORDER BY title ASC`,
      )
    ).rows;
  }
  async createCategory(input: CreateCategoryDto): Promise<Category> {
    return this.require(
      this.one(
        `INSERT INTO categories (title) VALUES ($1) RETURNING ${categoryFields}`,
        [input.title],
      ),
      'Category',
    );
  }
  async updateCategory(
    id: string,
    input: UpdateCategoryDto,
  ): Promise<Category> {
    return this.require(
      this.one(
        `UPDATE categories SET title = COALESCE($2, title) WHERE id = $1 RETURNING ${categoryFields}`,
        [id, input.title ?? null],
      ),
      'Category',
    );
  }
  async removeCategory(id: string) {
    await this.require(
      this.one(`DELETE FROM categories WHERE id = $1 RETURNING id`, [id]),
      'Category',
    );
    return { deleted: true };
  }

  async listInstructors(): Promise<Instructor[]> {
    return (
      await this.db.query<Instructor>(
        `SELECT ${instructorFields} FROM instructors ORDER BY created_at DESC`,
      )
    ).rows;
  }
  async createInstructor(input: CreateInstructorDto): Promise<Instructor> {
    return this.require(
      this.one(
        `INSERT INTO instructors (name, bio, avatar_url) VALUES ($1, $2, $3) RETURNING ${instructorFields}`,
        [input.name, input.bio, input.avatarUrl ?? null],
      ),
      'Instructor',
    );
  }
  async updateInstructor(
    id: string,
    input: UpdateInstructorDto,
  ): Promise<Instructor> {
    return this.require(
      this.one(
        `UPDATE instructors SET name = COALESCE($2, name), bio = COALESCE($3, bio), avatar_url = COALESCE($4, avatar_url) WHERE id = $1 RETURNING ${instructorFields}`,
        [id, input.name ?? null, input.bio ?? null, input.avatarUrl ?? null],
      ),
      'Instructor',
    );
  }
  async removeInstructor(id: string) {
    await this.require(
      this.one(`DELETE FROM instructors WHERE id = $1 RETURNING id`, [id]),
      'Instructor',
    );
    return { deleted: true };
  }

  async listCourses(categoryId?: string): Promise<Course[]> {
    const rows = await this.db.query<Course>(
      `${this.courseSelect()} WHERE c.is_published = true ${categoryId ? 'AND c.category_id = $1' : ''} ORDER BY c.created_at DESC`,
      categoryId ? [categoryId] : [],
    );
    return rows.rows;
  }
  async listAdminCourses(): Promise<Course[]> {
    return (
      await this.db.query<Course>(
        `${this.courseSelect()} ORDER BY c.created_at DESC`,
      )
    ).rows;
  }
  async getCourse(slug: string): Promise<Course> {
    const course = await this.one<Course>(
      `${this.courseSelect()} WHERE c.slug = $1 AND c.is_published = true`,
      [slug],
    );
    if (!course) this.notFound('Course');
    return course;
  }
  async createCourse(input: CreateCourseDto): Promise<Course> {
    return this.require(
      this.one(
        `INSERT INTO courses (slug, title, description, thumbnail_url, is_published, instructor_id, category_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${courseFields.replaceAll('c.', '')}`,
        [
          input.slug,
          input.title,
          input.description,
          input.thumbnailUrl ?? null,
          input.isPublished ?? false,
          input.instructorId,
          input.categoryId,
        ],
      ),
      'Course',
    );
  }
  async updateCourse(id: string, input: UpdateCourseDto): Promise<Course> {
    return this.require(
      this.one(
        `UPDATE courses SET slug=COALESCE($2,slug), title=COALESCE($3,title), description=COALESCE($4,description), thumbnail_url=COALESCE($5,thumbnail_url), is_published=COALESCE($6,is_published), instructor_id=COALESCE($7,instructor_id), category_id=COALESCE($8,category_id) WHERE id=$1 RETURNING ${courseFields.replaceAll('c.', '')}`,
        [
          id,
          input.slug ?? null,
          input.title ?? null,
          input.description ?? null,
          input.thumbnailUrl ?? null,
          input.isPublished ?? null,
          input.instructorId ?? null,
          input.categoryId ?? null,
        ],
      ),
      'Course',
    );
  }
  async removeCourse(id: string) {
    await this.require(
      this.one(`DELETE FROM courses WHERE id = $1 RETURNING id`, [id]),
      'Course',
    );
    return { deleted: true };
  }

  async createVideo(courseId: string, input: CreateVideoDto): Promise<Video> {
    await this.requireCourse(courseId);
    const video = await this.one<Video>(
      `INSERT INTO videos (course_id,title,description,is_free,position,duration_seconds,stream_status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${videoFields}`,
      [
        courseId,
        input.title,
        input.description ?? null,
        input.isFree ?? false,
        input.position,
        input.durationSeconds,
        StreamStatus.NotUploaded,
      ],
    );
    await this.recalculateCourse(courseId);
    return this.require(Promise.resolve(video), 'Video');
  }
  async updateVideo(id: string, input: UpdateVideoDto): Promise<Video> {
    const video = await this.require(
      this.one<Video>(
        `UPDATE videos SET title=COALESCE($2,title),description=COALESCE($3,description),is_free=COALESCE($4,is_free),position=COALESCE($5,position),duration_seconds=COALESCE($6,duration_seconds),updated_at=now() WHERE id=$1 RETURNING ${videoFields}`,
        [
          id,
          input.title ?? null,
          input.description ?? null,
          input.isFree ?? null,
          input.position ?? null,
          input.durationSeconds ?? null,
        ],
      ),
      'Video',
    );
    await this.recalculateCourse(video.courseId);
    return video;
  }
  async removeVideo(id: string) {
    const video = await this.requireVideoWithProvider(id);
    if (video.bunnyVideoId) await this.bunny.deleteVideo(video.bunnyVideoId);
    await this.db.query(`DELETE FROM videos WHERE id=$1`, [id]);
    await this.recalculateCourse(video.courseId);
    return { deleted: true };
  }

  async createVideoUploadSession(
    courseId: string,
    input: CreateVideoUploadSessionDto,
  ) {
    await this.requireCourse(courseId);
    const remote = await this.bunny.createVideo(
      input.title,
      input.thumbnailTime,
    );
    try {
      const video = await this.one<Video>(
        `INSERT INTO videos (course_id,title,description,is_free,position,bunny_video_id,stream_status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${videoFields}`,
        [
          courseId,
          input.title,
          input.description ?? null,
          input.isFree ?? false,
          input.position,
          remote.guid,
          StreamStatus.NotUploaded,
        ],
      );
      await this.recalculateCourse(courseId);
      return {
        video,
        upload: {
          ...this.bunny.createUploadCredentials(
            remote.guid,
            input.expiresInSeconds,
          ),
          metadata: { title: input.title },
        },
      };
    } catch (error) {
      try {
        await this.bunny.deleteVideo(remote.guid);
      } catch {}
      throw error;
    }
  }
  async getVideoPlayback(id: string) {
    const video = await this.requireVideoWithProvider(id);
    if (!video.bunnyVideoId)
      throw new AppException(
        ApiErrorCode.Conflict,
        'Video has not been uploaded yet',
        HttpStatus.CONFLICT,
      );
    if (video.streamStatus !== StreamStatus.Ready)
      throw new AppException(
        ApiErrorCode.Conflict,
        'Video is not ready for playback',
        HttpStatus.CONFLICT,
        { streamStatus: video.streamStatus },
      );
    return this.bunny.createSignedPlayback(video.bunnyVideoId);
  }
  async syncVideo(id: string) {
    const video = await this.requireVideoWithProvider(id);
    if (!video.bunnyVideoId)
      throw new AppException(
        ApiErrorCode.Conflict,
        'Video is not connected to Bunny Stream',
        HttpStatus.CONFLICT,
      );
    return this.bunnyWebhooks.syncVideo(video.bunnyVideoId);
  }

  private courseSelect() {
    return `SELECT ${courseFields}, jsonb_build_object('id', ca.id::text, 'title', ca.title, 'createdAt', ca.created_at) AS category, jsonb_build_object('id', i.id::text, 'name', i.name, 'bio', i.bio, 'avatarUrl', i.avatar_url, 'createdAt', i.created_at) AS instructor, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id::text,'title',v.title,'description',v.description,'isFree',v.is_free,'position',v.position,'durationSeconds',v.duration_seconds,'streamStatus',v.stream_status,'thumbnailUrl',v.thumbnail_url,'lastStreamEventAt',v.last_stream_event_at,'courseId',v.course_id::text,'createdAt',v.created_at,'updatedAt',v.updated_at) ORDER BY v.position) FROM videos v WHERE v.course_id = c.id), '[]'::jsonb) AS videos FROM courses c JOIN categories ca ON ca.id=c.category_id JOIN instructors i ON i.id=c.instructor_id`;
  }
  private async recalculateCourse(courseId: string) {
    await this.db.query(
      `UPDATE courses SET total_video=(SELECT COUNT(*) FROM videos WHERE course_id=$1), total_time=(SELECT COALESCE(SUM(duration_seconds),0) FROM videos WHERE course_id=$1) WHERE id=$1`,
      [courseId],
    );
  }
  private async requireCourse(id: string) {
    await this.require(
      this.one(`SELECT id FROM courses WHERE id=$1`, [id]),
      'Course',
    );
  }
  private async requireVideoWithProvider(id: string): Promise<Video> {
    return this.require(
      this.one<Video>(`SELECT ${videoFields} FROM videos WHERE id=$1`, [id]),
      'Video',
    );
  }
  private async one<T>(sql: string, values: unknown[] = []): Promise<T | null> {
    return this.db.oneOrNull<T>(sql, values);
  }
  private async require<T>(
    value: Promise<T | null>,
    label: string,
  ): Promise<T> {
    const entity = await value;
    if (!entity) this.notFound(label);
    return entity;
  }
  private notFound(label: string): never {
    throw new AppException(
      ApiErrorCode.ResourceNotFound,
      `${label} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}
