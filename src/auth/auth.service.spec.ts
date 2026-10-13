import { UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    name: 'Technician',
    email: 'tech@example.test',
    role: 'TECHNICIAN' as const,
    active: true,
    passwordHash: '',
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed-access-token') };
  const prisma = { user: { findUnique: vi.fn() } };
  const service = new AuthService(prisma as never, jwt as never);

  beforeEach(async () => {
    user.passwordHash = await hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue(user);
  });

  it('returns a bearer token and safe user profile after password verification', async () => {
    const result = await service.login(user.email, 'correct-password');
    expect(result).toMatchObject({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      user: { id: user.id, email: user.email, role: user.role },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('does not authenticate inactive users or incorrect passwords', async () => {
    await expect(service.login(user.email, 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
    prisma.user.findUnique.mockResolvedValue({ ...user, active: false });
    await expect(service.login(user.email, 'correct-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
