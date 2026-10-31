import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../apps/api/src/config.js';
import { validatePilotProductionConfig } from '../apps/api/src/config-preflight.js';

const configKeys = [
  'NODE_ENV',
  'HOST',
  'TRUST_PROXY',
  'PORT',
  'DATABASE_URL',
  'SESSION_SECRET',
  'PUBLIC_BASE_URL',
  'STORAGE_ROOT',
  'MEDIA_SIGNING_KEY',
  'MP_ACCESS_TOKEN',
  'MP_WEBHOOK_SECRET',
  'MP_SELLER_ID',
  'MP_ENVIRONMENT',
  'PAYMENTS_CHECKOUT_ENABLED',
  'MAIL_TRANSPORT',
  'MAIL_FROM',
  'PAYMENT_PROVIDER',
  'WORKER_CONCURRENCY',
];

function fail(message: string): void {
  console.error(`Production configuration check failed: ${message}`);
  process.exitCode = 1;
}

const args = process.argv.slice(2);
const envFileArgument =
  args.length === 2 && args[0] === '--env-file' ? args[1] :
  args.length === 1 && args[0].startsWith('--env-file=') ? args[0].slice(11) :
  '';

if (!envFileArgument || args.length > 2) {
  fail('Usage: npm run config:check -- --env-file /path/to/app.env');
} else {
  try {
    const envFile = path.resolve(envFileArgument);
    const fileInfo = fs.lstatSync(envFile);
    if (!fileInfo.isFile()) throw new Error('Environment file must be a regular, non-symlink file');
    if (![0o600, 0o640].includes(fileInfo.mode & 0o777))
      throw new Error('Environment file permissions are too broad; use 0600 or 0640');

    for (const key of configKeys) delete process.env[key];
    process.loadEnvFile(envFile);
    const explicitlyConfigured = new Set(
      configKeys.filter(key => process.env[key] !== undefined),
    );
    if (process.env.NODE_ENV !== 'production')
      throw new Error('NODE_ENV must be explicitly set to production');

    const config = loadConfig();
    const issues = validatePilotProductionConfig(config, explicitlyConfigured);
    if (issues.length) {
      fail(issues.join('\n  - '));
    } else {
      console.log(
        'Production pilot configuration passed static checks. Values and secrets were not printed.',
      );
      console.log(
        'This does not test SMTP, filesystem access as the service user, VPN, TLS, or external provider readiness.',
      );
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Unexpected configuration error');
  }
}
