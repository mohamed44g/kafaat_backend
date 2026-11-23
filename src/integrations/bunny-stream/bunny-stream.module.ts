import { Module } from '@nestjs/common';
import { BunnyStreamService } from './bunny-stream.service.js';
import { BunnyWebhookController } from './bunny-webhook.controller.js';
import { BunnyWebhookService } from './bunny-webhook.service.js';

@Module({
  controllers: [BunnyWebhookController],
  providers: [BunnyStreamService, BunnyWebhookService],
  exports: [BunnyStreamService, BunnyWebhookService],
})
export class BunnyStreamModule {}
