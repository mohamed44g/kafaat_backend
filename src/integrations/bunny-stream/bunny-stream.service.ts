import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum.js';
import { AppException } from '../../common/errors/app.exception.js';
import type {
  BunnyUploadCredentials,
  BunnyVideo,
} from './bunny-stream.types.js';
import { StreamStatus } from './bunny-stream.types.js';

interface BunnyErrorBody {
  message?: string;
  Message?: string;
  statusCode?: number;
}

@Injectable()
export class BunnyStreamService {
  private readonly baseUrl = 'https://video.bunnycdn.com';

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BunnyStreamService.name);
  }

  async createVideo(
    title: string,
    thumbnailTime?: number,
  ): Promise<BunnyVideo> {
    const body: { title: string; thumbnailTime?: number } = { title };
    if (thumbnailTime !== undefined) body.thumbnailTime = thumbnailTime;
    return this.request<BunnyVideo>('/videos', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getVideo(videoId: string): Promise<BunnyVideo> {
    return this.request<BunnyVideo>(`/videos/${encodeURIComponent(videoId)}`);
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.request<unknown>(`/videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    });
  }

  createUploadCredentials(
    videoId: string,
    requestedTtlSeconds?: number,
  ): BunnyUploadCredentials {
    const { libraryId, apiKey } = this.credentials();
    const configuredTtl = Number(
      this.config.get('BUNNY_STREAM_UPLOAD_TOKEN_TTL_SECONDS') ?? 7200,
    );
    const ttl = Math.min(
      86400,
      Math.max(3600, requestedTtlSeconds ?? configuredTtl),
    );
    const expirationTime = Math.floor(Date.now() / 1000) + ttl;
    const signature = createHash('sha256')
      .update(`${libraryId}${apiKey}${expirationTime}${videoId}`)
      .digest('hex');
    return {
      endpoint: `${this.baseUrl}/tusupload`,
      videoId,
      libraryId,
      expirationTime,
      signature,
    };
  }

  createSignedPlayback(videoId: string): { url: string; expires: number } {
    const { libraryId } = this.credentials();
    const tokenKey = this.config.get<string>('BUNNY_STREAM_TOKEN_AUTH_KEY');
    if (!tokenKey) this.notConfigured();
    const configuredTtl = Number(
      this.config.get('BUNNY_STREAM_PLAYBACK_TOKEN_TTL_SECONDS') ?? 300,
    );
    const ttl = Math.min(3600, Math.max(60, configuredTtl));
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const token = createHash('sha256')
      .update(`${tokenKey}${videoId}${expires}`)
      .digest('hex');
    const query = new URLSearchParams({ token, expires: String(expires) });
    return {
      url: `https://player.mediadelivery.net/embed/${libraryId}/${videoId}?${query.toString()}`,
      expires,
    };
  }

  mapApiStatus(status: number): StreamStatus {
    if (status === 4) return StreamStatus.Ready;
    if (status === 5 || status === 6) return StreamStatus.Failed;
    if (status === 0) return StreamStatus.NotUploaded;
    if (status === 1) return StreamStatus.Uploading;
    return StreamStatus.Processing;
  }

  mapWebhookStatus(status: number): StreamStatus | null {
    if (status === 3 || status === 4) return StreamStatus.Ready;
    if (status === 5 || status === 8) return StreamStatus.Failed;
    if (status === 6 || status === 7) return StreamStatus.Uploading;
    if (status === 0 || status === 1 || status === 2)
      return StreamStatus.Processing;
    if (status === 32) return StreamStatus.Deleted;
    return null;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { libraryId, apiKey } = this.credentials();
    const timeoutMs = Number(
      this.config.get('BUNNY_STREAM_REQUEST_TIMEOUT_MS') ?? 10000,
    );
    const url = `${this.baseUrl}/library/${libraryId}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          AccessKey: apiKey,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.error(
        { err: error, provider: 'bunny-stream', path, method: init.method },
        'Bunny Stream request failed',
      );
      throw new AppException(
        ApiErrorCode.VideoProviderUnavailable,
        'Video provider is temporarily unavailable',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      const text = await response.text();
      let providerBody: BunnyErrorBody = {};
      try {
        providerBody = JSON.parse(text) as BunnyErrorBody;
      } catch {
        // Provider may return plain text. It is intentionally not exposed.
      }
      this.logger.warn(
        {
          provider: 'bunny-stream',
          providerStatus: response.status,
          providerMessage: providerBody.message ?? providerBody.Message,
          path,
          method: init.method,
        },
        'Bunny Stream returned an error',
      );
      throw new AppException(
        ApiErrorCode.VideoProviderUnavailable,
        'Video provider rejected the request',
        response.status === 429
          ? HttpStatus.TOO_MANY_REQUESTS
          : HttpStatus.BAD_GATEWAY,
      );
    }

    if (response.status === HttpStatus.NO_CONTENT) return undefined as T;
    return (await response.json()) as T;
  }

  private credentials(): { libraryId: string; apiKey: string } {
    const libraryId = this.config.get<string>('BUNNY_STREAM_LIBRARY_ID');
    const apiKey = this.config.get<string>('BUNNY_STREAM_API_KEY');
    if (!libraryId || !apiKey) this.notConfigured();
    return { libraryId, apiKey };
  }

  private notConfigured(): never {
    throw new AppException(
      ApiErrorCode.VideoProviderNotConfigured,
      'Video provider is not configured',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
