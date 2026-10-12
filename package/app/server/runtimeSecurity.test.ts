import { describe, expect, it } from 'vitest';
import { resolveRuntimeSecurity } from './_core/runtimeSecurity';

describe('explicit local preview and production secret policy', () => {
  it('retains development defaults for ordinary local development', () => {
    expect(resolveRuntimeSecurity({ NODE_ENV: 'development' }).localAdminPassword).toBe('local-admin-change-me');
  });
  it('refuses production startup with missing private secrets', () => {
    expect(() => resolveRuntimeSecurity({ NODE_ENV: 'production' })).toThrow('private JWT_SECRET');
  });
  it('allows the explicit existing desktop preview only on loopback', () => {
    const runtime = resolveRuntimeSecurity({ NODE_ENV: 'production', LOCAL_PREVIEW: 'true', APP_ORIGIN: 'http://localhost:4173', LOCAL_ADMIN_PASSWORD: 'local-admin-change-me' });
    expect(runtime).toMatchObject({ localPreview: true, bindHost: '127.0.0.1', localAdminPassword: 'local-admin-change-me' });
    expect(runtime.cookieSecret.length).toBeGreaterThanOrEqual(32);
  });
  it.each(['http://192.168.1.8:4173', 'https://example.com', 'http://localhost.attacker.test', 'http://user@localhost:4173'])('rejects nonlocal/credential origin %s', (APP_ORIGIN) => {
    expect(() => resolveRuntimeSecurity({ NODE_ENV: 'production', LOCAL_PREVIEW: 'true', APP_ORIGIN })).toThrow('LOCAL_PREVIEW requires');
  });
  it('refuses a preview public listener override', () => {
    expect(() => resolveRuntimeSecurity({ LOCAL_PREVIEW: 'true', BIND_HOST: '0.0.0.0' })).toThrow('BIND_HOST must be 127.0.0.1');
  });
  it('refuses known default secrets outside preview even when supplied explicitly', () => {
    expect(() => resolveRuntimeSecurity({ NODE_ENV: 'production', JWT_SECRET: 'local-development-jwt-secret-change-me-32-chars', LOCAL_ADMIN_PASSWORD: 'local-admin-change-me' })).toThrow('no development default');
  });
  it('allows non-preview production only with private configuration', () => {
    expect(resolveRuntimeSecurity({ NODE_ENV: 'production', JWT_SECRET: 'only-a-test-private-key-with-32-characters', LOCAL_ADMIN_PASSWORD: 'only-a-test-password', APP_ORIGIN: 'https://terminal.example.test' })).toMatchObject({ localPreview: false, bindHost: '0.0.0.0' });
  });
});
