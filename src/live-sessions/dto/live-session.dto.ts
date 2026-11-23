import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateLiveSessionDto {
  @ApiProperty({ example: 'أسئلة وأجوبة في التكييف' })
  @IsString()
  @Length(2, 180)
  title: string;

  @ApiPropertyOptional({ example: 'جلسة مباشرة مع خبير الدورة' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiProperty({ example: '2026-12-01T17:00:00.000Z' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ minimum: 15, maximum: 1440, example: 60 })
  @IsInt()
  @Min(15)
  @Max(1440)
  durationMinutes: number;

}

export class UpdateLiveSessionDto extends PartialType(CreateLiveSessionDto) {}

