import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApiController } from './api.controller.js';
import { PrivatePhotosService } from './private-photos.service.js';
import { ProfileController } from './profile.controller.js';
import { LeaveController } from './leave.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ApiController, ProfileController, LeaveController],
  providers: [PrivatePhotosService],
})
export class ApiModule {}
