import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateBankTransferDto } from './dto/update-bank-transfer.dto.js';

export interface BankTransferSettings {
  bankName: string;
  accountHolderName: string;
  iban: string;
  accountNumber: string | null;
  swiftCode: string | null;
  supportWhatsapp: string;
  instructions: string;
  isActive: boolean;
  updatedAt: Date;
}

const fields = `bank_name AS "bankName",
  account_holder_name AS "accountHolderName", iban,
  account_number AS "accountNumber", swift_code AS "swiftCode",
  support_whatsapp AS "supportWhatsapp", instructions,
  is_active AS "isActive", updated_at AS "updatedAt"`;

@Injectable()
export class BankTransferService {
  constructor(private readonly db: DatabaseService) {}

  async get(): Promise<BankTransferSettings> {
    return (await this.db.oneOrNull<BankTransferSettings>(
      `SELECT ${fields} FROM bank_transfer_settings WHERE id = 1`,
    ))!;
  }

  async getPublic(): Promise<BankTransferSettings> {
    const settings = await this.get();
    if (settings.isActive) return settings;
    return {
      bankName: '',
      accountHolderName: '',
      iban: '',
      accountNumber: null,
      swiftCode: null,
      supportWhatsapp: '',
      instructions: '',
      isActive: false,
      updatedAt: settings.updatedAt,
    };
  }

  async update(input: UpdateBankTransferDto): Promise<BankTransferSettings> {
    return (await this.db.oneOrNull<BankTransferSettings>(
      `UPDATE bank_transfer_settings SET
       bank_name = $1, account_holder_name = $2, iban = $3,
       account_number = $4, swift_code = $5, support_whatsapp = $6,
       instructions = $7, is_active = $8, updated_at = now()
       WHERE id = 1 RETURNING ${fields}`,
      [
        input.bankName,
        input.accountHolderName,
        input.iban.replace(/\s/g, '').toUpperCase(),
        input.accountNumber?.trim() || null,
        input.swiftCode?.trim().toUpperCase() || null,
        input.supportWhatsapp.replace(/[\s()-]/g, ''),
        input.instructions,
        input.isActive,
      ],
    ))!;
  }
}
