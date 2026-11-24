import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { SessionService } from '../security/session.service.js';
import type { User } from '../users/entities/user.entity.js';

interface ChallengeRow {
  id: string;
  userId: string;
  purpose: 'setup' | 'verify';
  encryptedSecret: string;
  name: string;
  email: string;
  role: User['role'];
}

@Injectable()
export class MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly db: DatabaseService,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    const source =
      config.get<string>('MFA_ENCRYPTION_KEY') ??
      config.getOrThrow<string>('SESSION_HASH_PEPPER');
    this.encryptionKey = createHash('sha256').update(source).digest();
  }

  async begin(user: User) {
    const setupRequired = !user.mfaEnabled;
    let encryptedSecret = user.mfaSecretEncrypted;
    let setupSecret: string | undefined;
    if (setupRequired) {
      setupSecret = this.base32Encode(randomBytes(20));
      encryptedSecret = this.encrypt(setupSecret);
      await this.db.query(
        `UPDATE users SET mfa_secret_encrypted=$2, mfa_enabled=false,
         updated_at=now() WHERE id=$1`,
        [user.id, encryptedSecret],
      );
    }
    if (!encryptedSecret)
      throw new UnauthorizedException(
        'Multi-factor authentication unavailable',
      );

    const challengeToken = `kfm_${randomBytes(32).toString('base64url')}`;
    await this.db.query(
      `INSERT INTO auth_mfa_challenges
       (id, token_hash, user_id, purpose, expires_at)
       VALUES ($1,$2,$3,$4,now() + interval '5 minutes')`,
      [
        randomUUID(),
        this.sessions.hash(challengeToken),
        user.id,
        setupRequired ? 'setup' : 'verify',
      ],
    );
    return {
      mfaRequired: true,
      mfaSetupRequired: setupRequired,
      challengeToken,
      ...(setupSecret
        ? {
            setupSecret,
            otpauthUri: `otpauth://totp/${encodeURIComponent(`Kafaat:${user.email}`)}?secret=${setupSecret}&issuer=Kafaat&algorithm=SHA1&digits=6&period=30`,
          }
        : {}),
    };
  }

  async verify(challengeToken: string, code: string): Promise<ChallengeRow> {
    const challenge = await this.db.oneOrNull<ChallengeRow>(
      `SELECT c.id::text AS "id", c.user_id::text AS "userId",
       c.purpose, u.mfa_secret_encrypted AS "encryptedSecret",
       u.name, u.email, u.role
       FROM auth_mfa_challenges c JOIN users u ON u.id=c.user_id
       WHERE c.token_hash=$1 AND c.consumed_at IS NULL
       AND c.expires_at > now() AND c.attempt_count < 5`,
      [this.sessions.hash(challengeToken)],
    );
    if (
      !challenge ||
      !this.verifyTotp(this.decrypt(challenge.encryptedSecret), code)
    ) {
      await this.db.query(
        `UPDATE auth_mfa_challenges SET
         attempt_count=LEAST(5, attempt_count + 1),
         consumed_at=CASE WHEN attempt_count + 1 >= 5 THEN now() ELSE consumed_at END
         WHERE token_hash=$1 AND consumed_at IS NULL`,
        [this.sessions.hash(challengeToken)],
      );
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    return this.db.transaction(async (db) => {
      const consumed = await db.query(
        `UPDATE auth_mfa_challenges SET consumed_at=now()
         WHERE id=$1 AND consumed_at IS NULL RETURNING id`,
        [challenge.id],
      );
      if (!consumed.rowCount)
        throw new UnauthorizedException('Invalid or expired verification code');
      if (challenge.purpose === 'setup')
        await db.query(
          `UPDATE users SET mfa_enabled=true, updated_at=now() WHERE id=$1`,
          [challenge.userId],
        );
      return challenge;
    });
  }

  private verifyTotp(secret: string, supplied: string): boolean {
    const suppliedBuffer = Buffer.from(supplied);
    for (const offset of [-1, 0, 1]) {
      const expected = Buffer.from(
        this.totp(secret, Math.floor(Date.now() / 30_000) + offset),
      );
      if (
        expected.length === suppliedBuffer.length &&
        timingSafeEqual(expected, suppliedBuffer)
      )
        return true;
    }
    return false;
  }

  private totp(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', this.base32Decode(secret))
      .update(buffer)
      .digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return number.toString().padStart(6, '0');
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decrypt(value: string): string {
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted)
      throw new UnauthorizedException(
        'Multi-factor authentication unavailable',
      );
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private base32Encode(value: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let current = 0;
    let output = '';
    for (const byte of value) {
      current = (current << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(current >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += alphabet[(current << (5 - bits)) & 31];
    return output;
  }

  private base32Decode(value: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let current = 0;
    const output: number[] = [];
    for (const character of value.replace(/=+$/, '').toUpperCase()) {
      const index = alphabet.indexOf(character);
      if (index < 0) throw new Error('Invalid base32 secret');
      current = (current << 5) | index;
      bits += 5;
      if (bits >= 8) {
        output.push((current >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }
}
