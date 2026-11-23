import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BunnyWebhookService } from './bunny-webhook.service.js';
import { BunnyWebhookDto } from './dto/bunny-stream.dto.js';

@ApiExcludeController()
@SkipThrottle()
@Controller('webhooks/bunny')
export class BunnyWebhookController {
  constructor(private readonly webhooks: BunnyWebhookService) {}

  @Post('stream')
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Body() event: BunnyWebhookDto,
    @Headers('x-bunnystream-signature') signature?: string,
    @Headers('x-bunnystream-signature-version') version?: string,
    @Headers('x-bunnystream-signature-algorithm') algorithm?: string,
  ) {
    this.webhooks.verify(request.rawBody, { signature, version, algorithm });
    return this.webhooks.handle(event);
  }
}
