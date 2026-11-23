import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsISO8601,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateVideoUploadSessionDto {
  @ApiProperty({ example: 'مقدمة في أساسيات التكييف' })
  @IsString()
  @Length(2, 180)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  position: number;

  @ApiPropertyOptional({ minimum: 3600, maximum: 86400 })
  @IsOptional()
  @IsInt()
  @Min(3600)
  @Max(86400)
  expiresInSeconds?: number;

  @ApiPropertyOptional({ description: 'Thumbnail timestamp in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  thumbnailTime?: number;
}

export class BunnyWebhookDto {
  @ApiProperty() @IsBoolean() IsLiveStreamWebhook: boolean;
  @ApiProperty() @IsInt() VideoLibraryId: number;
  @ApiProperty() @IsUUID() VideoGuid: string;
  @ApiProperty() @IsInt() Status: number;
  @ApiProperty() @IsUUID() EventId: string;
  @ApiProperty() @IsISO8601() Timestamp: string;
  @ApiPropertyOptional() @IsOptional() @IsString() Reason?: string;
}
