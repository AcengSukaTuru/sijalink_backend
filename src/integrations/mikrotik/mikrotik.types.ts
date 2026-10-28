/** Konfigurasi koneksi RouterOS. Jangan pernah dikirim ke aplikasi klien. */
export interface RouterConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  timeoutMs: number;
}

/** Batas abstraksi agar implementasi protokol dapat ditukar dan diuji. */
export interface RouterOsClient {
  connect(): Promise<unknown>;
  write(
    command: string,
    ...params: string[]
  ): Promise<Record<string, unknown>[]>;
  close(): Promise<unknown>;
}
