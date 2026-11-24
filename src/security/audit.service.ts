import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../database/database.service.js';

export interface AuditEvent {
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: 'success' | 'denied' | 'failed';
  requestId?: string;
  ipHash?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO security_audit_log
         (actor_user_id, action, resource_type, resource_id, outcome,
          request_id, ip_hash, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [
          event.actorUserId ?? null,
          event.action,
          event.resourceType ?? null,
          event.resourceId ?? null,
          event.outcome,
          event.requestId ?? null,
          event.ipHash ?? null,
          JSON.stringify(event.metadata ?? {}),
        ],
      );
    } catch (error) {
      this.logger.error(
        { err: error, action: event.action },
        'Audit write failed',
      );
    }
  }
}
