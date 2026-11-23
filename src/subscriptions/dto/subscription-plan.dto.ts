import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'الباقة الأساسية' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'basic' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @ApiProperty({ example: 'وصول إلى جميع دورات المنصة.' })
  @IsString()
  @Length(2, 3000)
  description: string;

  @ApiProperty({ example: 7 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  price: number;

  @ApiProperty({ example: 1, description: 'Monthly billing interval' })
  @IsInt()
  @Min(1)
  @Max(36)
  durationMonths: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {}

export class CreatePlanFeatureDto {
  @ApiProperty({ example: 'online_sessions' })
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  featureKey: string;

  @ApiProperty({ example: 'الوصول إلى السيشنز الأونلاين' })
  @IsString()
  @Length(2, 180)
  label: string;
}
