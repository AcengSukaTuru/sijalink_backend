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
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Bearer token diperlukan.');
    try {
      req.user = await this.jwt.verifyAsync<Principal>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token tidak valid atau kedaluwarsa.');
    }
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
