import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { SessionService } from './session.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { SecurityController } from './security.controller.js';

@Global()
@Module({
  controllers: [SecurityController],
  providers: [SessionService, AuditService, JwtAuthGuard, RolesGuard],
  exports: [SessionService, AuditService],
})
export class SecurityModule {}
