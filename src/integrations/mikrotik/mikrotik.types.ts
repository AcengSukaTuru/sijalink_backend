/** Konfigurasi koneksi RouterOS v6. Jangan pernah dikirim ke aplikasi klien. */
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
  connect(config: RouterConnectionConfig): Promise<void>;
  close(): Promise<void>;
}
