import { randomUUID } from 'node:crypto';
import { rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrivatePhotosService } from './private-photos.service.js';

describe('private photos', () => {
  it('stores only recognized image bytes and prevents path traversal', async () => {
    const previous = process.env.PRIVATE_UPLOAD_DIR;
    const root = join(process.cwd(), `private-photos-test-${randomUUID()}`);
    process.env.PRIVATE_UPLOAD_DIR = root;
    const photos = new PrivatePhotosService();
    let key: string | undefined;
    try {
      await expect(
        photos.save({ buffer: Buffer.from('not an image'), size: 12 }),
      ).rejects.toThrow(BadRequestException);
      key = await photos.save({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        size: 4,
      });
      expect(key).toMatch(/\.jpg$/);
      await expect(photos.open('../.env')).rejects.toThrow(NotFoundException);
      const result = await photos.open(key);
      expect(result.getHeaders().type).toBe('image/jpeg');
    } finally {
      if (key) await photos.remove(key);
      if (key) await rmdir(root);
      if (previous === undefined) delete process.env.PRIVATE_UPLOAD_DIR;
      else process.env.PRIVATE_UPLOAD_DIR = previous;
    }
  });
});
