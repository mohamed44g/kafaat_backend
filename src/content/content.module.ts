import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';
import { BunnyStreamModule } from '../integrations/bunny-stream/bunny-stream.module.js';
import { SubscriptionGuard } from '../common/guards/subscription.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { CourseImageService } from './course-image.service.js';

@Module({
  imports: [BunnyStreamModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    SubscriptionGuard,
    CourseImageService,
  ],
  exports: [ContentService],
})
export class ContentModule {}
