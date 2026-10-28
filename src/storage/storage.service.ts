import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { StorageDriver } from './storage.types.js';

export const STORAGE_DRIVER_TOKEN = Symbol('STORAGE_DRIVER_TOKEN');

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_DRIVER_TOKEN)
    private readonly driver: StorageDriver,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.driver.init) {
      await this.driver.init();
      this.logger.log('Storage driver siap.');
    }
  }

  write(key: string, buffer: Buffer, contentType?: string): Promise<void> {
    return this.driver.write(key, buffer, contentType);
  }

  read(key: string): Promise<Buffer> {
    return this.driver.read(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  getSignedUrl(
    key: string,
    expiresInSeconds?: number,
  ): Promise<string> | undefined {
    return this.driver.getSignedUrl?.(key, expiresInSeconds);
  }

  getDriver(): StorageDriver {
    return this.driver;
  }
}
