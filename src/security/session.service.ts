import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { Cron } from '@nestjs/schedule';

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  private readonly ttlSeconds: number;
  private readonly idleSeconds: number;
  private readonly pepper: string;

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(config.get('SESSION_TTL_SECONDS') ?? 43_200);
    this.idleSeconds = Number(
      config.get('SESSION_IDLE_TIMEOUT_SECONDS') ?? 3_600,
    );
    this.pepper = config.getOrThrow<string>('SESSION_HASH_PEPPER');
  }

  async create(userId: string, context: SessionContext = {}) {
    const token = `kfs_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    await this.db.transaction(async (db) => {
      await db.query(
        `INSERT INTO auth_sessions
         (id, token_hash, user_id, expires_at, ip_hash, user_agent_hash)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          randomUUID(),
          this.hash(token),
          userId,
          expiresAt,
          this.contextHash(context.ip),
          this.contextHash(context.userAgent),
        ],
      );
      await db.query(
        `UPDATE auth_sessions SET revoked_at=now()
         WHERE user_id=$1 AND revoked_at IS NULL AND id NOT IN (
           SELECT id FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL
           ORDER BY created_at DESC LIMIT 5
         )`,
        [userId],
      );
    });
    return { token, expiresAt, expiresIn: this.ttlSeconds };
  }

  async validate(token: string): Promise<AuthUser> {
    const session = await this.db.oneOrNull<AuthUser>(
      `WITH valid_session AS (
         SELECT u.id::text AS sub, u.email, u.role, s.id::text AS "sessionId"
         FROM auth_sessions s JOIN users u ON u.id=s.user_id
         WHERE s.token_hash=$1 AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND s.last_seen_at > now() - make_interval(secs => $2::int)
       ), touched AS (
         UPDATE auth_sessions s SET last_seen_at=now()
         FROM valid_session v
         WHERE s.id::text=v."sessionId"
         AND s.last_seen_at < now() - interval '5 minutes'
       )
       SELECT sub, email, role, "sessionId" FROM valid_session`,
      [this.hash(token), this.idleSeconds],
    );
    if (!session) throw new UnauthorizedException('Invalid or expired session');
    return session;
  }

  async revoke(token: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions SET revoked_at=now()
       WHERE token_hash=$1 AND revoked_at IS NULL`,
      [this.hash(token)],
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions SET revoked_at=now()
       WHERE user_id=$1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  @Cron('0 30 3 * * *', { name: 'cleanup-security-state', timeZone: 'UTC' })
  async cleanupExpiredState(): Promise<void> {
    await this.db.transaction(async (db) => {
      await db.query(
        `DELETE FROM auth_sessions
         WHERE (expires_at < now() - interval '7 days')
         OR (revoked_at < now() - interval '7 days')`,
      );
      await db.query(
        `DELETE FROM auth_mfa_challenges
         WHERE expires_at < now() - interval '1 day'`,
      );
      await db.query(
        `DELETE FROM login_attempts
         WHERE updated_at < now() - interval '1 day'
         AND (locked_until IS NULL OR locked_until < now())`,
      );
      await db.query(
        `DELETE FROM security_audit_log
         WHERE created_at < now() - interval '365 days'`,
      );
    });
  }

  hash(value: string): string {
    return createHash('sha256').update(`${this.pepper}:${value}`).digest('hex');
  }

  private contextHash(value?: string): string | null {
    return value ? this.hash(value.slice(0, 500)) : null;
  }
}
