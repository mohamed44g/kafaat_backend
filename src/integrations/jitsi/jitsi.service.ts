import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum.js';
import { AppException } from '../../common/errors/app.exception.js';

interface JoinInput {
  roomName: string;
  userId: string;
  userName: string;
  userEmail: string;
  isModerator: boolean;
}

@Injectable()
export class JitsiService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(JitsiService.name);
  }

  createJoinConfig(input: JoinInput) {
    const meetUrl = this.required('JITSI_MEET_URL');
    const appId = this.required('JITSI_APP_ID');
    const secret = this.required('JITSI_APP_SECRET');
    let domain: string;
    try {
      domain =
        this.config.get<string>('JITSI_DOMAIN')?.trim() ||
        new URL(meetUrl).hostname;
    } catch {
      throw new AppException(
        ApiErrorCode.LiveProviderNotConfigured,
        'Jitsi meet URL must be a valid URL',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = Number(
      this.config.get<string>('JITSI_JOIN_TOKEN_TTL_SECONDS') ?? 7200,
    );
    const expiresAt = now + (Number.isFinite(ttl) && ttl > 60 ? ttl : 7200);
    const payload = {
      aud: appId,
      iss: appId,
      sub: domain,
      room: input.roomName,
      iat: now,
      nbf: now - 30,
      exp: expiresAt,
      context: {
        user: {
          id: input.userId,
          name: input.userName,
          email: input.userEmail,
          moderator: input.isModerator ? 'true' : 'false',
        },
      },
    };
    const encodedHeader = this.base64Url({ alg: 'HS256', typ: 'JWT' });
    const encodedPayload = this.base64Url(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    this.logger.debug(
      { roomName: input.roomName, isModerator: input.isModerator },
      'Jitsi join token issued',
    );
    return {
      meetUrl: new URL(meetUrl).origin,
      domain,
      roomName: input.roomName,
      jwt: `${signingInput}.${signature}`,
      userInfo: { displayName: input.userName, email: input.userEmail },
      expiresAt: new Date(expiresAt * 1000),
    };
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (value) return value;
    throw new AppException(
      ApiErrorCode.LiveProviderNotConfigured,
      'Jitsi integration is not configured',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private base64Url(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
