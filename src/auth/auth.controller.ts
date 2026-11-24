import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/interfaces/auth-user.interface.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyMfaDto } from './dto/verify-mfa.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a student account' })
  register(@Body() input: RegisterDto, @Req() request: Request) {
    return this.authService.register(input, this.context(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() input: LoginDto, @Req() request: Request) {
    return this.authService.login(input, this.context(request));
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete administrator TOTP verification' })
  verifyMfa(@Body() input: VerifyMfaDto, @Req() request: Request) {
    return this.authService.verifyMfa(
      input.challengeToken,
      input.code,
      this.context(request),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  logout(@Req() request: Request) {
    const token = request.headers.authorization?.slice('Bearer '.length) ?? '';
    return this.authService.logout(token);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: AuthUser) {
    await this.authService.logoutAll(user.sub);
    return { loggedOut: true };
  }

  private context(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
