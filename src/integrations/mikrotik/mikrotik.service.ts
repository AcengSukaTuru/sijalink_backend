import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  RouterConnectionConfig,
  RouterOsClient,
} from './mikrotik.types.js';

@Injectable()
export class MikrotikService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Sediakan konfigurasi privat untuk adapter RouterOS. Belum membuka operasi
   * router sampai kebutuhan ISP dan metode penyimpanan credential ditetapkan.
   */
  getConnectionConfig(): RouterConnectionConfig {
    const host = this.config.get<string>('MIKROTIK_HOST');
    const username = this.config.get<string>('MIKROTIK_USERNAME');
    const password = this.config.get<string>('MIKROTIK_PASSWORD');

    if (!host || !username || !password) {
      throw new ServiceUnavailableException(
        'Integrasi MikroTik belum dikonfigurasi.',
      );
    }

    return {
      host,
      username,
      password,
      port: Number(this.config.get<string>('MIKROTIK_PORT') ?? 8728),
      tls: this.config.get<string>('MIKROTIK_TLS') === 'true',
      timeoutMs: Number(this.config.get<string>('MIKROTIK_TIMEOUT_MS') ?? 5000),
    };
  }

  /**
   * Placeholder sengaja gagal tertutup: belum ada command yang dijalankan
   * sebelum adapter nyata, izin, dan use case operasional disepakati.
   */
  async withRouter<T>(
    _client: RouterOsClient,
    _operation: () => Promise<T>,
  ): Promise<T> {
    throw new ServiceUnavailableException(
      'Adapter RouterOS v6 belum diaktifkan. Tentukan use case terlebih dahulu.',
    );
  }
}
