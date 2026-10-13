import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './auth.js';

describe('RolesGuard', () => {
  const guard = new RolesGuard({
    getAllAndOverride: () => ['ADMIN'],
  } as unknown as Reflector);
  const context = (role?: string) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    }) as never;

  it('allows a user with an allowed role', () => {
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });

  it('rejects missing or insufficient roles', () => {
    expect(() => guard.canActivate(context('TECHNICIAN'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });
});
