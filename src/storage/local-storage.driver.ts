import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { StorageDriver } from './storage.types.js';

export class LocalStorageDriver implements StorageDriver {
  private readonly rootDir?: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir;
  }

  private get root(): string {
    return resolve(
      this.rootDir ?? process.env.PRIVATE_UPLOAD_DIR ?? 'private-uploads',
    );
  }

  async write(key: string, buffer: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, key), buffer, { flag: 'wx', mode: 0o600 });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.root, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
