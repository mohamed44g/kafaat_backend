import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionProvider } from '../../database/entities/subscription.entity.js';

export class CreateSubscriptionDto {
  @ApiProperty() @IsString() userId: string;
  @ApiProperty() @IsString() planId: string;
  @ApiProperty({ example: '2026-11-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;
  @ApiProperty({ enum: SubscriptionProvider, required: false })
  @IsOptional()
  @IsEnum(SubscriptionProvider)
  provider?: SubscriptionProvider;
}
