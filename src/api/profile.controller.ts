import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  Logger,
  Patch,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard } from '../auth/auth.js';
import type { Principal } from '../auth/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PrivatePhotosService,
  type PhotoUpload,
} from './private-photos.service.js';

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export const profileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  address: true,
  phone: true,
  photoKey: true,
  createdAt: true,
} as const;
export function publicProfile<T extends { photoKey: string | null }>(user: T) {
  const { photoKey, ...fields } = user;
  return {
    ...fields,
    photoUrl: photoKey ? '/api/v1/users/me/photo' : null,
    router: null,
  };
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);
  constructor(
    private readonly db: PrismaService,
    private readonly photos: PrivatePhotosService,
  ) {}

  @Patch()
  async update(@CurrentUser() actor: Principal, @Body() dto: UpdateProfileDto) {
    return publicProfile(
      await this.db.user.update({
        where: { id: actor.sub },
        data: dto,
        select: profileSelect,
      }),
    );
  }

  @Get('photo')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async photo(@CurrentUser() actor: Principal): Promise<StreamableFile> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actor.sub },
      select: { photoKey: true },
    });
    return this.photos.open(user.photoKey);
  }

  @Put('photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async putPhoto(
    @CurrentUser() actor: Principal,
    @UploadedFile() file?: PhotoUpload,
  ) {
    const key = await this.photos.save(file);
    let previousKey: string | null;
    try {
      const previous = await this.db.user.findUniqueOrThrow({
        where: { id: actor.sub },
        select: { photoKey: true },
      });
      previousKey = previous.photoKey;
      const changed = await this.db.user.updateMany({
        where: { id: actor.sub, photoKey: previousKey },
        data: { photoKey: key },
      });
      if (!changed.count)
        throw new ConflictException('Foto profil berubah; muat ulang.');
    } catch (error) {
      await this.photos.remove(key);
      throw error;
    }
    try {
      await this.photos.remove(previousKey);
    } catch (error) {
      this.logger.warn(`Gagal menghapus foto profil lama: ${String(error)}`);
    }
    return publicProfile(
      await this.db.user.findUniqueOrThrow({
        where: { id: actor.sub },
        select: profileSelect,
      }),
    );
  }

  @Delete('photo')
  async deletePhoto(@CurrentUser() actor: Principal) {
    const previous = await this.db.user.findUniqueOrThrow({
      where: { id: actor.sub },
      select: { photoKey: true },
    });
    const changed = await this.db.user.updateMany({
      where: { id: actor.sub, photoKey: previous.photoKey },
      data: { photoKey: null },
    });
    if (!changed.count)
      throw new ConflictException('Foto profil berubah; muat ulang.');
    try {
      await this.photos.remove(previous.photoKey);
    } catch (error) {
      this.logger.warn(`Gagal menghapus foto profil lama: ${String(error)}`);
    }
    return { success: true };
  }
}
