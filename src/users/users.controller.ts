import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserRole } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() input: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, input);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'List users (admin only)' })
  listUsers() {
    return this.usersService.findAll();
  }
}
