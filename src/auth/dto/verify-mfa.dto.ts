import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty() @IsString() @Length(20, 200) challengeToken: string;
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code: string;
}
