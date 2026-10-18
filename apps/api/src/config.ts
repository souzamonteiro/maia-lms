// Configuration loading and validation for Maia LMS API
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    TRUST_PROXY: z.string().default('loopback'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .refine(value => !/^[a-z]+:\/\//i.test(value), 'Use a local SQLite filesystem path')
      .default('./data/maia-lms.db'),
    SESSION_SECRET: z.string().min(32),
    PUBLIC_BASE_URL: z.string().url(),
    STORAGE_ROOT: z.string().default('./data/storage'),
    MEDIA_SIGNING_KEY: z.string().min(32),
    MP_ACCESS_TOKEN: z.string().optional(),
    MP_WEBHOOK_SECRET: z.string().optional(),
    MP_SELLER_ID: z.string().optional(),
    MP_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    PAYMENTS_CHECKOUT_ENABLED: z.preprocess(
      value => {
        if (typeof value !== 'string') return value;
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
        return value;
      },
      z.boolean(),
    ).default(false),
    MAIL_TRANSPORT: z.string().default('smtp://localhost:1025'),
    MAIL_FROM: z.string().default('noreply@maiaplatform.org'),
    PAYMENT_PROVIDER: z.enum(['mercado_pago', 'fake']).default('fake'),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  })
  .superRefine((config, context) => {
    if (config.PAYMENT_PROVIDER === 'mercado_pago') {
      const expectedEnvironment = config.NODE_ENV === 'production' ? 'production' : 'sandbox';
      if (config.MP_ENVIRONMENT !== expectedEnvironment)
        context.addIssue({
          code: 'custom',
          path: ['MP_ENVIRONMENT'],
          message: `${config.NODE_ENV} must use Mercado Pago ${expectedEnvironment} credentials`,
        });
    }
    if (config.PAYMENTS_CHECKOUT_ENABLED) {
      if (config.PAYMENT_PROVIDER !== 'mercado_pago')
        context.addIssue({
          code: 'custom',
          path: ['PAYMENT_PROVIDER'],
          message: 'Enabled checkout requires the Mercado Pago provider',
        });
      for (const key of ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'MP_SELLER_ID'] as const) {
        if (!config[key])
          context.addIssue({ code: 'custom', path: [key], message: 'Required when checkout is enabled' });
      }
    }
    if (config.NODE_ENV === 'production') {
      if (!config.PUBLIC_BASE_URL.startsWith('https://'))
        context.addIssue({
          code: 'custom',
          path: ['PUBLIC_BASE_URL'],
          message: 'Production requires HTTPS',
        });
      for (const key of ['SESSION_SECRET', 'MEDIA_SIGNING_KEY'] as const) {
        if (config[key].startsWith('CHANGE_ME'))
          context.addIssue({ code: 'custom', path: [key], message: 'Replace the example secret' });
      }
    }
  });

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Loads, validates, and returns the application configuration.
 * Call once at startup before constructing any infrastructure.
 */
export function loadConfig(): Config {
  if (process.env['NODE_ENV'] !== 'production') {
    const file = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }

  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return result.data;
}
