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
    MAIL_TRANSPORT: z.string().default('smtp://localhost:1025'),
    MAIL_FROM: z.string().default('noreply@maiaplatform.org'),
    PAYMENT_PROVIDER: z.enum(['mercado_pago', 'fake']).default('fake'),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  })
  .superRefine((config, context) => {
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
