import fs from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import { runMigrations } from '../apps/api/dist/db/migrate.js';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-lms-e2e-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '4320',
  PUBLIC_BASE_URL: 'http://127.0.0.1:4320',
  DATABASE_URL: path.join(directory, 'test.db'),
  STORAGE_ROOT: path.join(directory, 'storage'),
  SESSION_SECRET: 'e2e-only-session-secret-at-least-32-characters',
  MEDIA_SIGNING_KEY: 'e2e-only-media-key-at-least-32-characters',
});
const db = new Database(process.env.DATABASE_URL);
runMigrations(db);
db.prepare(
  "INSERT INTO users(id,email,email_normalized,password_hash,role) VALUES ('e2e-admin','admin@example.com','admin@example.com',?,'admin')",
).run(await argon2.hash('Admin-test-password-123'));
db.close();
if (process.env.VIDEO_TEST_REAL === '1') {
  const worker = spawn(process.execPath, ['apps/worker/dist/worker.js'], {
    env: process.env,
    stdio: 'ignore',
  });
  process.on('exit', () => worker.kill('SIGKILL'));
}
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
await import('../apps/api/dist/server.js');
