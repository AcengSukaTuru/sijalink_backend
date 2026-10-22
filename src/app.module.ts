import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { MikrotikModule } from './integrations/mikrotik/mikrotik.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ApiModule } from './api/api.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, string | undefined>) => {
        if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
          throw new Error('JWT_SECRET must contain at least 32 characters.');
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(env.WORK_START_TIME ?? '08:00')) {
          throw new Error('WORK_START_TIME must use HH:mm (24-hour time).');
        }
        try {
          new Intl.DateTimeFormat('en-US', {
            timeZone: env.BUSINESS_TIMEZONE ?? 'Asia/Jakarta',
          });
        } catch {
          throw new Error('BUSINESS_TIMEZONE must be a valid IANA time zone.');
        }
        return env;
      },
    }),
    PrismaModule,
    AuthModule,
    ApiModule,
    HealthModule,
    MikrotikModule,
  ],
})
export class AppModule {}
