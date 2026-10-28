import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard } from './auth.js';
import type { Principal } from './auth.js';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicProfile } from '../api/profile.controller.js';

class LoginDto {
  @ApiProperty({
    example: 'admin.demo@sijalink.test',
    description: 'Email akun pengguna.',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SijaLink-Demo-2026!',
    description: 'Password akun pengguna.',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}
  @Post('login') login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: Principal) {
    return publicProfile(
      await this.prisma.user.findUniqueOrThrow({
        where: { id: user.sub },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          address: true,
          phone: true,
          photoKey: true,
          createdAt: true,
        },
      }),
    );
  }
}
