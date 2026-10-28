import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterOSAPI } from 'node-routeros-v2';
import type {
  RouterConnectionConfig,
  RouterOsClient,
} from './mikrotik.types.js';

const READ_TIMEOUT_FALLBACK_MS = 5000;
const TLS_CIPHERS =
  'ADH-AES256-GCM-SHA384:ADH-AES128-GCM-SHA256:@SECLEVEL=0';

@Injectable()
export class MikrotikService {
  constructor(private readonly config: ConfigService) {}

  getConnectionConfig(): RouterConnectionConfig {
    const host = this.config.get<string>('MIKROTIK_HOST');
    const username = this.config.get<string>('MIKROTIK_USERNAME');
    const password = this.config.get<string>('MIKROTIK_PASSWORD');

    if (!host || !username || !password) {
      throw new ServiceUnavailableException(
        'Integrasi MikroTik belum dikonfigurasi.',
      );
    }

    const port = Number(this.config.get<string>('MIKROTIK_PORT') ?? 8728);
    const timeoutMs = Number(
      this.config.get<string>('MIKROTIK_TIMEOUT_MS') ?? READ_TIMEOUT_FALLBACK_MS,
    );
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException('MIKROTIK_PORT tidak valid.');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 100) {
      throw new ServiceUnavailableException('MIKROTIK_TIMEOUT_MS tidak valid.');
    }

    return {
      host,
      username,
      password,
      port,
      tls: this.config.get<string>('MIKROTIK_TLS') === 'true',
      timeoutMs,
    };
  }

  async withRouter<T>(operation: (client: RouterOsClient) => Promise<T>) {
    const config = this.getConnectionConfig();
    const client = this.createClient(config);
    try {
      await client.connect();
      return await operation(client);
    } catch (error) {
      throw new ServiceUnavailableException(this.connectionError(error));
    } finally {
      try {
        await client.close();
      } catch {
        // Preserve command/connect error. Close is best effort.
      }
    }
  }

  async identity() {
    return this.withRouter((client) => client.write('/system/identity/print'));
  }

  async resource() {
    return this.withRouter((client) => client.write('/system/resource/print'));
  }

  async interfaces() {
    return this.withRouter((client) => client.write('/interface/print'));
  }

  async activePpp() {
    return this.withRouter((client) => client.write('/ppp/active/print'));
  }

  private createClient(config: RouterConnectionConfig): RouterOsClient {
    const api = new RouterOSAPI({
      host: config.host,
      user: config.username,
      password: config.password,
      port: config.port,
      timeout: Math.max(1, Math.ceil(config.timeoutMs / 1000)),
      ...(config.tls
        ? {
            tls: {
              rejectUnauthorized: false,
              ciphers: TLS_CIPHERS,
            },
          }
        : {}),
    });
    return api as unknown as RouterOsClient;
  }

  private connectionError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/CANTLOGIN|login/i.test(message))
      return 'Login ke MikroTik gagal.';
    if (/timeout|timed out|SOCKTMOUT/i.test(message))
      return 'Koneksi ke MikroTik timeout.';
    return 'MikroTik tidak dapat dijangkau.';
  }
}
