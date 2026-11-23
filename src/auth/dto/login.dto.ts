import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ahmed@example.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @Length(8, 128)
  password: string;
}
