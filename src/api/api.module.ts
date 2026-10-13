import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApiController } from './api.controller.js';

@Module({ imports: [AuthModule], controllers: [ApiController] })
export class ApiModule {}
