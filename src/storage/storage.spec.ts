import { describe, expect, it, vi } from 'vitest';
import { LocalStorageDriver } from './local-storage.driver.js';
import { MinioStorageDriver } from './minio-storage.driver.js';
import { StorageService } from './storage.service.js';
import type { StorageDriver } from './storage.types.js';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { rmdir } from 'node:fs/promises';

describe('storage drivers', () => {
  it('local storage driver writes, reads, and deletes files', async () => {
    const tempDir = join(process.cwd(), `local-storage-test-${randomUUID()}`);
    const driver = new LocalStorageDriver(tempDir);
    const key = `test-${randomUUID()}.jpg`;
    const buffer = Buffer.from([1, 2, 3, 4]);

    try {
      await driver.write(key, buffer);
      const readBuffer = await driver.read(key);
      expect(readBuffer).toEqual(buffer);

      await driver.delete(key);
      await expect(driver.read(key)).rejects.toThrow();
    } finally {
      await rmdir(tempDir).catch(() => {});
    }
  });

  it('minio storage driver sends correct s3 commands', async () => {
    const driver = new MinioStorageDriver({
      endpoint: 'localhost',
      port: 9000,
      useSsl: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      bucket: 'test-bucket',
    });

    const mockSend = vi.fn().mockImplementation((command: { constructor: { name: string } }) => {
      const name = command.constructor.name;
      if (name === 'HeadBucketCommand' || name === 'PutObjectCommand' || name === 'DeleteObjectCommand') {
        return Promise.resolve({});
      }
      if (name === 'GetObjectCommand') {
        return Promise.resolve({
          Body: {
            transformToByteArray: () => Promise.resolve(new Uint8Array([5, 6, 7, 8])),
          },
        });
      }
      return Promise.resolve({});
    });

    // Replace internal S3 client send
    (driver as unknown as { client: { send: typeof mockSend } }).client.send = mockSend;

    const key = 'test.png';
    const buffer = Buffer.from([5, 6, 7, 8]);

    await driver.write(key, buffer, 'image/png');
    expect(mockSend).toHaveBeenCalled();

    const read = await driver.read(key);
    expect(read).toEqual(buffer);

    await driver.delete(key);
    expect(mockSend).toHaveBeenCalled();
  });

  it('storage service delegates to underlying driver', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    const mockRead = vi.fn().mockResolvedValue(Buffer.from([9, 9]));
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockGetSignedUrl = vi
      .fn()
      .mockResolvedValue('https://minio.test/signed-url');

    const mockDriver: StorageDriver = {
      write: mockWrite,
      read: mockRead,
      delete: mockDelete,
      getSignedUrl: mockGetSignedUrl,
    };

    const service = new StorageService(mockDriver);
    await service.write('k', Buffer.from([9]));
    expect(mockWrite).toHaveBeenCalledWith('k', Buffer.from([9]), undefined);

    const data = await service.read('k');
    expect(data).toEqual(Buffer.from([9, 9]));

    await service.delete('k');
    expect(mockDelete).toHaveBeenCalledWith('k');

    const url = await service.getSignedUrl('k', 60);
    expect(url).toBe('https://minio.test/signed-url');
  });
});
