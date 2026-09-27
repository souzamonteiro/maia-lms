/* Test environment configuration for vitest */
import { beforeAll } from 'vitest';

beforeAll(() => {
  // Set minimum required env vars for config validation
  process.env['SESSION_SECRET'] = 'test-session-secret-that-is-long-enough-32chars';
  process.env['PUBLIC_BASE_URL'] = 'http://localhost:3000';
  process.env['MEDIA_SIGNING_KEY'] = 'test-media-signing-key-that-is-long-enough-32';
  process.env['NODE_ENV'] = 'test';
});
