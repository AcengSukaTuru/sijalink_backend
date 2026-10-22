import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export type Principal = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN';
};
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal =>
    ctx.switchToHttp().getRequest().user,
);
export const Roles = (...roles: Principal['role'][]) =>
  SetMetadata('roles', roles);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Bearer token diperlukan.');
    let payload: Principal;
    try {
      payload = await this.jwt.verifyAsync<Principal>(token);
    } catch {
      throw new UnauthorizedException('Token tidak valid atau kedaluwarsa.');
    }
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, active: true },
    });
    if (!user?.active) throw new UnauthorizedException('Akun tidak aktif.');
    req.user = {
      sub: user.id,
      email: user.email,
      role: user.role,
    } satisfies Principal;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Principal['role'][]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest().user as
      Principal | undefined;
    if (!user || !roles.includes(user.role))
      throw new ForbiddenException(
        'Role tidak memiliki izin untuk operasi ini.',
      );
    return true;
  }
}
