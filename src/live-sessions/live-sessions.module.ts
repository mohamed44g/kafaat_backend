import { Module } from '@nestjs/common';
import { JitsiModule } from '../integrations/jitsi/jitsi.module.js';
import { LiveSessionsController } from './live-sessions.controller.js';
import { LiveSessionsService } from './live-sessions.service.js';

@Module({
  imports: [JitsiModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
})
export class LiveSessionsModule {}

