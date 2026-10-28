import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LocalStorageDriver } from '../storage/local-storage.driver.js';
import { StorageService } from '../storage/storage.service.js';
import type { StorageDriver } from '../storage/storage.types.js';

export type PhotoUpload = { buffer: Buffer; size: number };

@Injectable()
export class PrivatePhotosService {
  private readonly storage: StorageDriver;

  constructor(@Optional() storageService?: StorageService) {
    this.storage = storageService?.getDriver() ?? new LocalStorageDriver();
  }

  async save(file?: PhotoUpload): Promise<string> {
    if (!file?.buffer?.length || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'Foto wajib berupa JPEG, PNG, atau WebP maksimal 5 MB.',
      );
    }
    const bytes = file.buffer;
    const ext = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      ? 'jpg'
      : bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'png'
        : bytes.subarray(0, 4).toString() === 'RIFF' &&
            bytes.subarray(8, 12).toString() === 'WEBP'
          ? 'webp'
          : null;
    if (!ext)
      throw new BadRequestException('Format foto harus JPEG, PNG, atau WebP.');
    const key = `${randomUUID()}.${ext}`;
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    await this.storage.write(key, bytes, contentType);
    return key;
  }

  async open(key: string | null): Promise<StreamableFile> {
    if (!key || !this.validKey(key))
      throw new NotFoundException('Foto tidak ditemukan.');
    try {
      const buffer = await this.storage.read(key);
      const type = key.endsWith('.png')
        ? 'image/png'
        : key.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
      return new StreamableFile(buffer, { type, disposition: 'inline' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('Foto tidak ditemukan.');
      throw error;
    }
  }

  async remove(key: string | null): Promise<void> {
    if (!key || !this.validKey(key)) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async getSignedUrl(
    key: string | null,
    expiresInSeconds?: number,
  ): Promise<string | null> {
    if (!key || !this.validKey(key)) return null;
    return (await this.storage.getSignedUrl?.(key, expiresInSeconds)) ?? null;
  }

  private validKey(key: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(
      key,
    );
  }
}
