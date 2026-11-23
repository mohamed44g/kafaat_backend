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
import {
  CreateLiveSessionDto,
  UpdateLiveSessionDto,
} from './dto/live-session.dto.js';
import { LiveSessionsService } from './live-sessions.service.js';

@ApiTags('live sessions')
@Controller()
export class LiveSessionsController {
  constructor(private readonly sessions: LiveSessionsService) {}

  @Get('live-sessions')
  @ApiOperation({ summary: 'List upcoming Jitsi live sessions' })
  list() {
    return this.sessions.listUpcoming();
  }

  @Get('live-sessions/:id/join')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get a short-lived Jitsi join token and room configuration',
  })
  join(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.getJoinConfig(user, id);
  }

  @Get('admin/live-sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  listAdmin() {
    return this.sessions.listAdmin();
  }

  @Post('admin/live-sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  create(@Body() input: CreateLiveSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.create(input, user.sub);
  }

  @Patch('admin/live-sessions/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  update(@Param('id') id: string, @Body() input: UpdateLiveSessionDto) {
    return this.sessions.update(id, input);
  }

  @Delete('admin/live-sessions/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  remove(@Param('id') id: string) {
    return this.sessions.remove(id);
  }

}

