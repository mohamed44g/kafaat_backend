import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { BankTransferController } from './bank-transfer.controller.js';
import { BankTransferService } from './bank-transfer.service.js';

@Module({
  controllers: [BankTransferController],
  providers: [BankTransferService, JwtAuthGuard, RolesGuard],
})
export class BankTransferModule {}
