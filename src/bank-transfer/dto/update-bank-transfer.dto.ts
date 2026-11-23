import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateBankTransferDto {
  @ApiProperty({ example: 'بنك الكويت الوطني' })
  @IsString()
  @Length(2, 160)
  bankName: string;

  @ApiProperty({ example: 'شركة كفاءات للتدريب' })
  @IsString()
  @Length(2, 180)
  accountHolderName: string;

  @ApiProperty({ example: 'KW00BANK0000000000000000000000' })
  @IsString()
  @Length(8, 64)
  iban: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(6, 32)
  swiftCode?: string;

  @ApiProperty({ example: '+96550000000' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  supportWhatsapp: string;

  @ApiProperty({ example: 'حوّل قيمة الاشتراك ثم أرسل صورة التحويل إلى الدعم.' })
  @IsString()
  @Length(2, 3000)
  instructions: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  isActive: boolean;
}
