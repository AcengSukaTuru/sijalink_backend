import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './local-storage.driver.js';
import { MinioStorageDriver } from './minio-storage.driver.js';
import { STORAGE_DRIVER_TOKEN, StorageService } from './storage.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_DRIVER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';
        if (driver === 'minio') {
          return new MinioStorageDriver({
            endpoint: config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
            port: Number(config.get<string>('MINIO_PORT') ?? 9000),
            useSsl: config.get<string>('MINIO_USE_SSL') === 'true',
            accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? '',
            secretKey: config.get<string>('MINIO_SECRET_KEY') ?? '',
            bucket: config.get<string>('MINIO_BUCKET') ?? 'sijalink-private',
            region: config.get<string>('MINIO_REGION') ?? 'us-east-1',
          });
        }
        return new LocalStorageDriver(config.get<string>('PRIVATE_UPLOAD_DIR'));
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
