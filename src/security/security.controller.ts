import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { DatabaseService } from '../database/database.service.js';
import { UserRole } from '../users/entities/user.entity.js';

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/security')
export class SecurityController {
  constructor(private readonly db: DatabaseService) {}

  @Get('audit-log')
  @ApiOperation({ summary: 'List recent security audit events' })
  async auditLog(
    @Query('limit') rawLimit?: string,
    @Query('beforeId') beforeId?: string,
  ) {
    const parsed = Number(rawLimit ?? 100);
    const limit = Number.isInteger(parsed)
      ? Math.min(200, Math.max(1, parsed))
      : 100;
    return (
      await this.db.query(
        `SELECT id::text AS "id", actor_user_id::text AS "actorUserId",
         action, resource_type AS "resourceType", resource_id AS "resourceId",
         outcome, request_id AS "requestId", metadata,
         created_at AS "createdAt"
         FROM security_audit_log
         WHERE ($2::bigint IS NULL OR id < $2::bigint)
         ORDER BY id DESC LIMIT $1`,
        [limit, beforeId ?? null],
      )
    ).rows;
  }
}
