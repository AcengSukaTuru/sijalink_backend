export interface StorageDriver {
  init?(): Promise<void>;
  write(key: string, buffer: Buffer, contentType?: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}
