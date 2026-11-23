import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UsersModule } from '../users/users.module.js';
import {
  SubscriptionPlansController,
  SubscriptionsController,
} from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  imports: [UsersModule],
  controllers: [SubscriptionsController, SubscriptionPlansController],
  providers: [SubscriptionsService, JwtAuthGuard, RolesGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
