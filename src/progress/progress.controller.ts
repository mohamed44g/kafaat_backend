import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../common/guards/subscription.guard.js';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';
import { ProgressService } from './progress.service.js';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}
  @Put('videos/:videoId')
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: 'Save playback progress; completes at 90%' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('videoId') videoId: string,
    @Body() input: UpdateProgressDto,
  ) {
    return this.progress.update(user.sub, videoId, input.watchedDuration);
  }
  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Get course completion percentage' })
  course(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.progress.courseProgress(user.sub, courseId);
  }
}
