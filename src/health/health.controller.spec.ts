import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns an ok health status', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('sijalink-backend');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
