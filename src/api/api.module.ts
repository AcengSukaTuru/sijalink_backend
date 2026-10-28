import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApiController } from './api.controller.js';
import { PrivatePhotosService } from './private-photos.service.js';
import { ProfileController } from './profile.controller.js';
import { LeaveController } from './leave.controller.js';
import { MikrotikModule } from '../integrations/mikrotik/mikrotik.module.js';

@Module({
  imports: [AuthModule, MikrotikModule],
  controllers: [ApiController, ProfileController, LeaveController],
  providers: [PrivatePhotosService],
})
export class ApiModule {}
