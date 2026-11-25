import { Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { DatabaseService } from '../database/database.service.js';
import { AuditService } from '../security/audit.service.js';
import {
  SessionService,
  type SessionContext,
} from '../security/session.service.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly db: DatabaseService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterDto, context: SessionContext = {}) {
    const user = await this.usersService.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.replace(/[\s()-]/g, ''),
      passwordHash: await hash(input.password),
    });
    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.register',
      outcome: 'success',
      ipHash: context.ip ? this.sessions.hash(context.ip) : undefined,
    });
    return this.createSession(user, context);
  }

  async login(input: LoginDto, context: SessionContext = {}) {
    const email = input.email.trim().toLowerCase();
    const attemptKey = this.sessions.hash(
      `${email}:${context.ip ?? 'unknown'}`,
    );
    const blocked = await this.db.oneOrNull<{ blocked: boolean }>(
      `SELECT locked_until > now() AS blocked FROM login_attempts
       WHERE identifier_hash=$1`,
      [attemptKey],
    );
    if (blocked?.blocked) {
      await this.recordLogin(email, context, 'denied', 'locked');
      throw new UnauthorizedException('Invalid email or password');
    }
    const user = await this.usersService.findByEmailWithPassword(email);
    const validPassword = await verify(
      user?.passwordHash ??
        '$argon2id$v=19$m=65536,t=3,p=4$jZ4x/mkrCH3wDQ0aBbvBtQ$Ab81xJOnrtFKdtUeq+ieSQdEJvBeecFaH4IXRouRAfM',
      input.password,
    );
    if (!user || !validPassword) {
      await this.db.query(
        `INSERT INTO login_attempts
         (identifier_hash, attempt_count, first_attempt_at, locked_until, updated_at)
         VALUES ($1,1,now(),NULL,now())
         ON CONFLICT (identifier_hash) DO UPDATE SET
           attempt_count = CASE
             WHEN login_attempts.first_attempt_at < now() - interval '15 minutes'
               THEN 1 ELSE login_attempts.attempt_count + 1 END,
           first_attempt_at = CASE
             WHEN login_attempts.first_attempt_at < now() - interval '15 minutes'
               THEN now() ELSE login_attempts.first_attempt_at END,
           locked_until = CASE
             WHEN (CASE
               WHEN login_attempts.first_attempt_at < now() - interval '15 minutes'
                 THEN 1 ELSE login_attempts.attempt_count + 1 END) >= 5
               THEN now() + interval '15 minutes' ELSE NULL END,
           updated_at=now()`,
        [attemptKey],
      );
      await this.recordLogin(email, context, 'denied', 'invalid_credentials');
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.db.query('DELETE FROM login_attempts WHERE identifier_hash=$1', [
      attemptKey,
    ]);
    await this.recordLogin(email, context, 'success', null, user.id);
    return this.createSession(user, context);
  }

  async logout(token: string): Promise<{ loggedOut: true }> {
    await this.sessions.revoke(token);
    return { loggedOut: true };
  }

  logoutAll(userId: string): Promise<void> {
    return this.sessions.revokeAllForUser(userId);
  }

  private async createSession(
    user: {
      id: string;
      email: string;
      role: string;
      name: string;
    },
    context: SessionContext,
  ) {
    const session = await this.sessions.create(user.id, context);
    return {
      accessToken: session.token,
      tokenType: 'Bearer',
      expiresIn: session.expiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  private recordLogin(
    email: string,
    context: SessionContext,
    outcome: 'success' | 'denied',
    reason: string | null,
    actorUserId?: string,
  ) {
    return this.audit.record({
      actorUserId,
      action: 'auth.login',
      outcome,
      ipHash: context.ip ? this.sessions.hash(context.ip) : undefined,
      metadata: { emailHash: this.sessions.hash(email), reason },
    });
  }
}
