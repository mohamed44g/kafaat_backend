import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../common/errors/api-error-code.enum.js';
import { AppException } from '../common/errors/app.exception.js';

export const COURSE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const COURSE_IMAGE_PUBLIC_PREFIX = '/api/v1/uploads/courses/';
const COURSE_IMAGE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;

@Injectable()
export class CourseImageService {
  private readonly directory = join(
    resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')),
    'courses',
  );

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(CourseImageService.name);
  }

  async store(file?: Express.Multer.File) {
    if (!file)
      throw new AppException(
        ApiErrorCode.ValidationFailed,
        'Course image is required',
        HttpStatus.BAD_REQUEST,
      );
    if (
      file.size > COURSE_IMAGE_MAX_BYTES ||
      !this.hasSupportedSignature(file.buffer)
    )
      throw new AppException(
        ApiErrorCode.ValidationFailed,
        'Only valid JPEG, PNG, or WebP images up to 5 MB are allowed',
        HttpStatus.BAD_REQUEST,
      );

    let output: Buffer;
    let info: OutputInfo;
    try {
      ({ data: output, info } = await sharp(file.buffer, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: 1920,
          height: 1080,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 84, effort: 4 })
        .toBuffer({ resolveWithObject: true }));
    } catch {
      throw new AppException(
        ApiErrorCode.ValidationFailed,
        'The uploaded file is not a safe, readable image',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!info.width || !info.height || output.length > COURSE_IMAGE_MAX_BYTES)
      throw new AppException(
        ApiErrorCode.ValidationFailed,
        'The processed image exceeds the allowed limits',
        HttpStatus.BAD_REQUEST,
      );

    await mkdir(this.directory, { recursive: true, mode: 0o750 });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(this.directory, filename), output, {
      flag: 'wx',
      mode: 0o640,
    });
    return {
      url: `${COURSE_IMAGE_PUBLIC_PREFIX}${filename}`,
      width: info.width,
      height: info.height,
      size: output.length,
    };
  }

  async removeByPublicUrl(publicUrl: string | null | undefined) {
    const filename = this.filenameFromPublicUrl(publicUrl);
    if (!filename) return false;
    try {
      return await this.remove(filename);
    } catch (error) {
      this.logger.warn(
        { err: error, filename },
        'Course image cleanup will be retried manually',
      );
      return false;
    }
  }

  async remove(filename: string) {
    if (!COURSE_IMAGE_NAME.test(filename))
      throw new AppException(
        ApiErrorCode.ValidationFailed,
        'Invalid course image name',
        HttpStatus.BAD_REQUEST,
      );
    try {
      await unlink(join(this.directory, filename));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      this.logger.error(
        { err: error, filename },
        'Failed to remove course image',
      );
      throw error;
    }
  }

  publicUrl(filename: string) {
    if (!COURSE_IMAGE_NAME.test(filename)) return null;
    return `${COURSE_IMAGE_PUBLIC_PREFIX}${filename}`;
  }

  private filenameFromPublicUrl(publicUrl: string | null | undefined) {
    if (!publicUrl?.startsWith(COURSE_IMAGE_PUBLIC_PREFIX)) return null;
    const filename = publicUrl.slice(COURSE_IMAGE_PUBLIC_PREFIX.length);
    return COURSE_IMAGE_NAME.test(filename) ? filename : null;
  }

  private hasSupportedSignature(buffer: Buffer) {
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const isPng =
      buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature);
    const isWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    return isJpeg || isPng || isWebp;
  }
}
