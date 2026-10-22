import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, RolesGuard } from './auth.js';

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

describe('JwtAuthGuard', () => {
  it('rejects a token when its user has been disabled', async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'disabled' }) };
    const db = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'disabled', active: false }),
      },
    };
    const guard = new JwtAuthGuard(jwt as never, db as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-token' },
        }),
      }),
    } as never;
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
