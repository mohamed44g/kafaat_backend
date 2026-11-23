import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../common/guards/subscription.guard.js';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

@Module({
  controllers: [ProgressController],
  providers: [ProgressService, JwtAuthGuard, SubscriptionGuard],
})
export class ProgressModule {}
