import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'أحمد محمد' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 'ahmed@example.com' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ example: '+966501234567', description: 'E.164 format' })
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must use E.164 format' })
  phone: string;

  @ApiProperty({ minLength: 12, example: 'StrongPassword123!' })
  @IsString()
  @Length(12, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'password must include uppercase, lowercase, number and special character',
  })
  password: string;
}
