import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const user = await this.usersService.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.replace(/[\s()-]/g, ''),
      passwordHash: await hash(input.password),
    });
    return this.createSession(user);
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      input.email.trim().toLowerCase(),
    );
    if (!user || !(await verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.createSession(user);
  }

  private async createSession(user: {
    id: string;
    email: string;
    role: string;
    name: string;
  }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 900),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
