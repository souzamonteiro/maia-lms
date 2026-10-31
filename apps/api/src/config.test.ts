import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.js';
import { validatePilotProductionConfig } from './config-preflight.js';

const baseEnvironment = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  TRUST_PROXY: 'loopback',
  PORT: '3000',
  DATABASE_URL: './data/test.db',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  STORAGE_ROOT: './data/storage',
  MEDIA_SIGNING_KEY: 'test-media-signing-key-at-least-32-characters',
  MP_ACCESS_TOKEN: '',
  MP_WEBHOOK_SECRET: '',
  MP_SELLER_ID: '',
  MP_ENVIRONMENT: 'sandbox',
  PAYMENTS_CHECKOUT_ENABLED: 'false',
  PAYMENT_PROVIDER: 'fake',
  MAIL_TRANSPORT: 'smtp://localhost:1025',
  MAIL_FROM: 'noreply@example.test',
  WORKER_CONCURRENCY: '4',
};

beforeEach(() => {
  for (const [key, value] of Object.entries(baseEnvironment)) vi.stubEnv(key, value);
});

afterEach(() => vi.unstubAllEnvs());

describe('payment environment configuration', () => {
  it('defaults to fake payments, sandbox mode, and disabled hosted checkout', () => {
    expect(loadConfig()).toMatchObject({
      PAYMENT_PROVIDER: 'fake',
      MP_ENVIRONMENT: 'sandbox',
      PAYMENTS_CHECKOUT_ENABLED: false,
    });
  });

  describe('production pilot configuration preflight', () => {
    const explicitlyConfigured = new Set([
      'NODE_ENV',
      'HOST',
      'TRUST_PROXY',
      'PORT',
      'DATABASE_URL',
      'SESSION_SECRET',
      'PUBLIC_BASE_URL',
      'STORAGE_ROOT',
      'MEDIA_SIGNING_KEY',
      'MAIL_TRANSPORT',
      'MAIL_FROM',
      'PAYMENTS_CHECKOUT_ENABLED',
    ]);

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('HOST', '10.77.0.2');
      vi.stubEnv('TRUST_PROXY', '10.77.0.1');
      vi.stubEnv('PORT', '3200');
      vi.stubEnv('DATABASE_URL', '/var/lib/maia-lms/maia-lms.db');
      vi.stubEnv('PUBLIC_BASE_URL', 'https://learn.example.test');
      vi.stubEnv('STORAGE_ROOT', '/var/lib/maia-lms/storage');
      vi.stubEnv('MAIL_TRANSPORT', 'smtps://mailer.example.test:465');
      vi.stubEnv('PAYMENTS_CHECKOUT_ENABLED', 'false');
    });

    it('accepts a production free-pilot configuration without exposing values', () => {
      expect(validatePilotProductionConfig(loadConfig(), explicitlyConfigured)).toEqual([]);
    });

    it('requires explicit persistent paths, external SMTP, and checkout disabled', () => {
      vi.stubEnv('PAYMENT_PROVIDER', 'mercado_pago');
      vi.stubEnv('MP_ENVIRONMENT', 'production');
      vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-production-token');
      vi.stubEnv('MP_WEBHOOK_SECRET', 'private-webhook-secret');
      vi.stubEnv('MP_SELLER_ID', 'private-seller-id');
      vi.stubEnv('PAYMENTS_CHECKOUT_ENABLED', 'true');
      vi.stubEnv('DATABASE_URL', './relative.db');
      vi.stubEnv('STORAGE_ROOT', './storage');
      vi.stubEnv('MAIL_TRANSPORT', 'smtp://localhost:1025');

      expect(validatePilotProductionConfig(loadConfig(), new Set())).toEqual(
        expect.arrayContaining([
          'NODE_ENV must be explicitly set',
          'PAYMENTS_CHECKOUT_ENABLED must be explicitly set',
          'PAYMENTS_CHECKOUT_ENABLED must be false for a free pilot',
          'DATABASE_URL must be an absolute persistent path',
          'STORAGE_ROOT must be an absolute persistent path',
          'MAIL_TRANSPORT must use a non-local SMTP host',
        ]),
      );
    });

    it('rejects loopback SMTP endpoints without reporting the configured URL', () => {
      vi.stubEnv('MAIL_TRANSPORT', 'smtp://user:private-password@127.0.0.1:1025');
      const issues = validatePilotProductionConfig(loadConfig(), explicitlyConfigured);
      expect(issues).toContain('MAIL_TRANSPORT must use a non-local SMTP host');
      expect(issues.join(' ')).not.toContain('private-password');
    });

    it('checks a protected environment file without printing its secret values', () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-config-preflight-'));
      const envFile = path.join(directory, 'app.env');
      const secret = 'preflight-session-secret-value-at-least-32-characters';
      const values = [
        'NODE_ENV=production',
        'HOST=10.77.0.2',
        'TRUST_PROXY=10.77.0.1',
        'PORT=3200',
        'DATABASE_URL=/var/lib/maia-lms/maia-lms.db',
        `SESSION_SECRET=${secret}`,
        'PUBLIC_BASE_URL=https://learn.example.test',
        'STORAGE_ROOT=/var/lib/maia-lms/storage',
        'MEDIA_SIGNING_KEY=preflight-media-signing-key-at-least-32-characters',
        'MAIL_TRANSPORT=smtps://mailer.example.test:465',
        'MAIL_FROM=noreply@example.test',
        'PAYMENTS_CHECKOUT_ENABLED=false',
      ];
      fs.writeFileSync(envFile, `${values.join('\n')}\n`, { mode: 0o600 });
      try {
        const output = execFileSync(
          process.execPath,
          ['--import', 'tsx', path.resolve('scripts/check-production-config.ts'), '--env-file', envFile],
          { encoding: 'utf8', env: { PATH: process.env.PATH } },
        );
        expect(output).toContain('passed static checks');
        expect(output).not.toContain(secret);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it('rejects environment files that are readable by other users', () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-config-preflight-'));
      const envFile = path.join(directory, 'app.env');
      fs.writeFileSync(envFile, 'SESSION_SECRET=private-preflight-secret\n', { mode: 0o644 });
      try {
        let output = '';
        try {
          execFileSync(
            process.execPath,
            ['--import', 'tsx', path.resolve('scripts/check-production-config.ts'), '--env-file', envFile],
            { encoding: 'utf8', env: { PATH: process.env.PATH }, stdio: 'pipe' },
          );
        } catch (error) {
          output = String(error);
          if (error && typeof error === 'object' && 'stderr' in error)
            output += String(error.stderr);
        }
        expect(output).toContain('permissions are too broad');
        expect(output).not.toContain('private-preflight-secret');
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it('rejects a protected production configuration that enables checkout', () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-config-preflight-'));
      const envFile = path.join(directory, 'app.env');
      const secret = 'preflight-session-secret-value-at-least-32-characters';
      const values = [
        'NODE_ENV=production',
        'HOST=10.77.0.2',
        'TRUST_PROXY=10.77.0.1',
        'PORT=3200',
        'DATABASE_URL=/var/lib/maia-lms/maia-lms.db',
        `SESSION_SECRET=${secret}`,
        'PUBLIC_BASE_URL=https://learn.example.test',
        'STORAGE_ROOT=/var/lib/maia-lms/storage',
        'MEDIA_SIGNING_KEY=preflight-media-signing-key-at-least-32-characters',
        'MAIL_TRANSPORT=smtps://mailer.example.test:465',
        'MAIL_FROM=noreply@example.test',
        'PAYMENT_PROVIDER=mercado_pago',
        'MP_ENVIRONMENT=production',
        'MP_ACCESS_TOKEN=APP_USR-production-token',
        'MP_WEBHOOK_SECRET=private-webhook-secret',
        'MP_SELLER_ID=private-seller-id',
        'PAYMENTS_CHECKOUT_ENABLED=true',
      ];
      fs.writeFileSync(envFile, `${values.join('\n')}\n`, { mode: 0o600 });
      try {
        let output = '';
        try {
          execFileSync(
            process.execPath,
            ['--import', 'tsx', path.resolve('scripts/check-production-config.ts'), '--env-file', envFile],
            { encoding: 'utf8', env: { PATH: process.env.PATH }, stdio: 'pipe' },
          );
        } catch (error) {
          output = String(error);
          if (error && typeof error === 'object' && 'stderr' in error)
            output += String(error.stderr);
        }
        expect(output).toContain('PAYMENTS_CHECKOUT_ENABLED must be false for a free pilot');
        expect(output).not.toContain(secret);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  });

  it('allows explicitly enabled sandbox checkout with sandbox credentials', () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'mercado_pago');
    vi.stubEnv('PAYMENTS_CHECKOUT_ENABLED', 'true');
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-test-account-token');
    vi.stubEnv('MP_WEBHOOK_SECRET', 'test-webhook-secret');
    vi.stubEnv('MP_SELLER_ID', 'test-seller-id');

    expect(loadConfig()).toMatchObject({
      PAYMENT_PROVIDER: 'mercado_pago',
      MP_ENVIRONMENT: 'sandbox',
      PAYMENTS_CHECKOUT_ENABLED: true,
    });
  });

  it('rejects enabled checkout with the fake provider or missing provider credentials', () => {
    vi.stubEnv('PAYMENTS_CHECKOUT_ENABLED', 'true');
    expect(() => loadConfig()).toThrow(/PAYMENT_PROVIDER/);

    vi.stubEnv('PAYMENT_PROVIDER', 'mercado_pago');
    expect(() => loadConfig()).toThrow(/MP_ACCESS_TOKEN/);
  });

  it('rejects ambiguous values for the checkout enablement flag', () => {
    vi.stubEnv('PAYMENTS_CHECKOUT_ENABLED', 'off');
    expect(() => loadConfig()).toThrow(/PAYMENTS_CHECKOUT_ENABLED/);
  });

  it('rejects sandbox/production credential-mode mismatches', () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'mercado_pago');
    vi.stubEnv('MP_ENVIRONMENT', 'production');
    expect(() => loadConfig()).toThrow(/MP_ENVIRONMENT/);

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PUBLIC_BASE_URL', 'https://learn.example.test');
    vi.stubEnv('MP_ENVIRONMENT', 'sandbox');
    expect(() => loadConfig()).toThrow(/MP_ENVIRONMENT/);
  });

  it('allows production credentials only in production configuration', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PUBLIC_BASE_URL', 'https://learn.example.test');
    vi.stubEnv('PAYMENT_PROVIDER', 'mercado_pago');
    vi.stubEnv('MP_ENVIRONMENT', 'production');
    vi.stubEnv('PAYMENTS_CHECKOUT_ENABLED', 'true');
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-production-token');
    vi.stubEnv('MP_WEBHOOK_SECRET', 'production-webhook-secret');
    vi.stubEnv('MP_SELLER_ID', 'production-seller-id');

    expect(loadConfig()).toMatchObject({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'mercado_pago',
      MP_ENVIRONMENT: 'production',
      PAYMENTS_CHECKOUT_ENABLED: true,
    });
  });
});