import { Module } from '@nestjs/common';
import { MikrotikService } from './mikrotik.service.js';

@Module({ providers: [MikrotikService], exports: [MikrotikService] })
export class MikrotikModule {}
