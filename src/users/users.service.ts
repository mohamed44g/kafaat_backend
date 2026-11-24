import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiErrorCode } from '../common/errors/api-error-code.enum.js';
import { AppException } from '../common/errors/app.exception.js';
import { DatabaseService } from '../database/database.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { User } from './entities/user.entity.js';

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
}

const userFields = `
  id::text AS "id", name, email, phone, password_hash AS "passwordHash",
  mfa_secret_encrypted AS "mfaSecretEncrypted", mfa_enabled AS "mfaEnabled",
  role, is_subscribed AS "isSubscribed", subscription_ends_at AS "subscriptionEndsAt",
  avatar_url AS "avatarUrl", created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.db.query<User>(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING ${userFields}`,
      [input.name, input.email, input.phone, input.passwordHash],
    );
    return result.rows[0]!;
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.db.oneOrNull<User>(
      `SELECT ${userFields} FROM users WHERE LOWER(email) = $1`,
      [email.toLowerCase()],
    );
  }

  async findById(id: string): Promise<User> {
    const user = await this.db.oneOrNull<User>(
      `SELECT ${userFields} FROM users WHERE id = $1`,
      [id],
    );
    if (!user) this.notFound();
    return user;
  }

  async updateProfile(id: string, input: UpdateProfileDto): Promise<User> {
    const result = await this.db.query<User>(
      `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email),
       phone = COALESCE($4, phone), updated_at = now() WHERE id = $1
       RETURNING ${userFields}`,
      [
        id,
        input.name?.trim() ?? null,
        input.email?.trim().toLowerCase() ?? null,
        input.phone?.replace(/[\s()-]/g, '') ?? null,
      ],
    );
    if (!result.rows[0]) this.notFound();
    return result.rows[0];
  }

  async findAll(): Promise<User[]> {
    return (
      await this.db.query<User>(
        `SELECT ${userFields} FROM users ORDER BY created_at DESC LIMIT 100`,
      )
    ).rows;
  }

  private notFound(): never {
    throw new AppException(
      ApiErrorCode.ResourceNotFound,
      'User not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
