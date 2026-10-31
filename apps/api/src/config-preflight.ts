import path from 'node:path';
import type { Config } from './config.js';

const requiredPilotSettings = [
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
] as const;

export function validatePilotProductionConfig(
  config: Config,
  explicitlyConfigured: ReadonlySet<string>,
): string[] {
  const issues = requiredPilotSettings
    .filter(key => !explicitlyConfigured.has(key))
    .map(key => `${key} must be explicitly set`);

  if (config.NODE_ENV !== 'production') issues.push('NODE_ENV must be production');
  if (config.PAYMENTS_CHECKOUT_ENABLED)
    issues.push('PAYMENTS_CHECKOUT_ENABLED must be false for a free pilot');
  if (!path.isAbsolute(config.DATABASE_URL))
    issues.push('DATABASE_URL must be an absolute persistent path');
  if (!path.isAbsolute(config.STORAGE_ROOT))
    issues.push('STORAGE_ROOT must be an absolute persistent path');

  let mailUrl: URL | undefined;
  try {
    mailUrl = new URL(config.MAIL_TRANSPORT);
  } catch {
    issues.push('MAIL_TRANSPORT must be a valid SMTP URL');
  }
  if (mailUrl) {
    const hostname = mailUrl.hostname.toLowerCase().replace(/\.$/, '');
    const isLoopback =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '[::1]' ||
      /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (!['smtp:', 'smtps:'].includes(mailUrl.protocol) || !hostname || isLoopback)
      issues.push('MAIL_TRANSPORT must use a non-local SMTP host');
  }

  return issues;
}
