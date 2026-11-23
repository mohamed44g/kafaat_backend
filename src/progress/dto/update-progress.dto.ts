import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateProgressDto {
  @ApiProperty({ description: 'Watched position in seconds', example: 125 })
  @IsInt()
  @Min(0)
  watchedDuration: number;
}
