import { Module } from '@nestjs/common';
import { JitsiService } from './jitsi.service.js';

@Module({
  providers: [JitsiService],
  exports: [JitsiService],
})
export class JitsiModule {}
