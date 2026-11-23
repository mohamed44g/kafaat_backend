import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { BankTransferService } from './bank-transfer.service.js';
import { UpdateBankTransferDto } from './dto/update-bank-transfer.dto.js';

@ApiTags('bank transfer')
@Controller()
export class BankTransferController {
  constructor(private readonly bankTransfer: BankTransferService) {}

  @Get('bank-transfer')
  @ApiOperation({ summary: 'Get bank transfer and support instructions' })
  get() {
    return this.bankTransfer.getPublic();
  }

  @Get('admin/bank-transfer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Get complete bank transfer settings for admins' })
  getAdmin() {
    return this.bankTransfer.get();
  }

  @Put('admin/bank-transfer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Update bank transfer settings' })
  update(@Body() input: UpdateBankTransferDto) {
    return this.bankTransfer.update(input);
  }
}
