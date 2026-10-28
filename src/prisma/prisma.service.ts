import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (
      process.env.NODE_ENV !== 'test' &&
      process.env.AUTO_MIGRATE !== 'false'
    ) {
      try {
        this.logger.log('Menjalankan migrasi database otomatis...');
        execSync('npx prisma migrate deploy', { stdio: 'pipe' });
        this.logger.log('Migrasi database selesai.');
      } catch (error) {
        this.logger.error('Gagal menjalankan migrasi otomatis:', error);
        throw error;
      }
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
