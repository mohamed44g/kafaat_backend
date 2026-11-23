import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import {
  CreatePlanFeatureDto,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}
  @Get('me')
  @ApiOperation({ summary: 'Get current subscription status' })
  current(@CurrentUser() user: AuthUser) {
    return this.subscriptions.getCurrent(user.sub);
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Create a manual subscription (super admin)' })
  create(@Body() input: CreateSubscriptionDto) {
    return this.subscriptions.create(input);
  }
}

@ApiTags('subscription plans')
@Controller()
export class SubscriptionPlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  plans() {
    return this.subscriptions.listPlans(true);
  }

  @Get('admin/plans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'List all subscription plans for admins' })
  adminPlans() {
    return this.subscriptions.listPlans(false);
  }

  @Post('admin/plans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  createPlan(@Body() input: CreateSubscriptionPlanDto) {
    return this.subscriptions.createPlan(input);
  }

  @Patch('admin/plans/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  updatePlan(
    @Param('id') id: string,
    @Body() input: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptions.updatePlan(id, input);
  }

  @Delete('admin/plans/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  removePlan(@Param('id') id: string) {
    return this.subscriptions.removePlan(id);
  }

  @Post('admin/plans/:id/features')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  addFeature(@Param('id') id: string, @Body() input: CreatePlanFeatureDto) {
    return this.subscriptions.addFeature(id, input);
  }

  @Delete('admin/plans/:planId/features/:featureId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  removeFeature(
    @Param('planId') planId: string,
    @Param('featureId') featureId: string,
  ) {
    return this.subscriptions.removeFeature(planId, featureId);
  }
}
