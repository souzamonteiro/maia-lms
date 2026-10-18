import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';

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