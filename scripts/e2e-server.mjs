import { randomUUID, createHash } from 'node:crypto';
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
  TRUST_PROXY: 'loopback',
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
  "INSERT INTO users(id,email,email_normalized,password_hash,role,locale) VALUES ('e2e-admin','admin@example.com','admin@example.com',?,'admin','en')",
).run(await argon2.hash('Admin-test-password-123'));
// Verification fixtures are deliberately not login accounts.
db.prepare(
  "INSERT INTO users(id,email,email_normalized,password_hash) VALUES('e2e-verification','verify@example.com','verify@example.com','not-a-login-hash')",
).run();
for (const digit of ['1', '2', '3', '4', '5']) {
  const hash = createHash('sha256').update(digit.repeat(64)).digest('hex');
  db.prepare(
    "INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at,used_at) VALUES(?,'e2e-verification',?,'verify',?,?)",
  ).run(
    randomUUID(),
    hash,
    digit === '4' ? '2000-01-01T00:00:00Z' : new Date(Date.now() + 3600000).toISOString(),
    digit === '5' ? new Date().toISOString() : null,
  );
}
// Catalog fixtures avoid spending the application's request budget on test setup.
for (let i = 0; i < 13; i++) {
  const id = randomUUID(),
    revision = randomUUID(),
    module = randomUUID();
  db.prepare(
    "INSERT INTO courses(id,slug,author_id,status,access_mode,locale) VALUES(?,?,'e2e-admin','PUBLISHED','OPEN_FREE','en')",
  ).run(id, `catalog-fixture-${i}`);
  db.prepare(
    "INSERT INTO course_revisions(id,course_id,title,summary,slug,locale,level,access_mode,published_at) VALUES(?,?,?,'Catalog pagination fixture',?,'en','beginner','OPEN_FREE',datetime('now'))",
  ).run(revision, id, `Catalog fixture ${String(i).padStart(2, '0')}`, `catalog-fixture-${i}`);
  db.prepare('INSERT INTO modules(id,revision_id,title,sort_order) VALUES(?,?,?,0)').run(
    module,
    revision,
    'Module',
  );
  db.prepare(
    "INSERT INTO lessons(id,module_id,title,body,sort_order) VALUES(?,?,'Lesson','Text',0)",
  ).run(randomUUID(), module);
  db.prepare('UPDATE courses SET current_revision_id=?,published_revision_id=? WHERE id=?').run(
    revision,
    revision,
    id,
  );
}
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
