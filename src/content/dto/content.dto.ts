import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'التكييف والتبريد' })
  @IsString()
  @Length(2, 120)
  title: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateInstructorDto {
  @ApiProperty({ example: 'محمد أحمد' })
  @IsString()
  @Length(2, 150)
  name: string;
  @ApiProperty({ example: 'خبير في أنظمة التكييف' })
  @IsString()
  @Length(10, 5000)
  bio: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string;
}
export class UpdateInstructorDto extends PartialType(CreateInstructorDto) {}

export class CreateCourseDto {
  @ApiProperty({ example: 'أساسيات التكييف والتبريد' })
  @IsString()
  @Length(2, 180)
  title: string;
  @ApiProperty({ example: 'ac-basics' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
  @ApiProperty() @IsString() @Length(10, 10000) description: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(
    /^\/api\/v1\/uploads\/courses\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
  )
  thumbnailUrl?: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty() @IsString() instructorId: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class CreateVideoDto {
  @ApiProperty() @IsString() @Length(2, 180) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;
  @ApiProperty() @IsInt() @Min(1) position: number;
  @ApiProperty({ description: 'Duration in seconds' })
  @IsInt()
  @Min(0)
  durationSeconds: number;
}
export class UpdateVideoDto extends PartialType(CreateVideoDto) {}
