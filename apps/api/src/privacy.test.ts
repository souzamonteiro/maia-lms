import { afterEach, beforeEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';

let db: Database.Database;
let server: Server;
let base: string;
const password = 'Privacy-test-password-123';

async function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  return {
    status: response.status,
    data: response.headers.get('content-type')?.includes('json') ? await response.json() : null,
    headers: response.headers,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}

async function register(email: string) {
  const created = await request('/api/v1/auth/register', 'POST', { email, password });
  expect(created.status).toBe(201);
  const login = await request('/api/v1/auth/login', 'POST', { email, password });
  expect(login.status).toBe(200);
  return { id: created.data.id as string, cookie: login.cookie };
}

beforeEach(async () => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  server = createApp(db, loadConfig()).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()),
  );
  db.close();
});

it('exports only the authenticated account data and never includes authentication secrets', async () => {
  const owner = await register('privacy-owner@example.com');
  const other = await register('privacy-other@example.com');
  db.exec(`INSERT INTO courses(id,slug,author_id) VALUES('privacy-course','privacy-course','${owner.id}');
    INSERT INTO courses(id,slug,author_id) VALUES('other-course','other-course','${other.id}');`);
  db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
    VALUES('owner-media',?,'privacy-course','my-notes.txt',32,'attachment'),
      ('other-media',?,'other-course','private-file.txt',16,'attachment')`).run(owner.id, other.id);
  db.prepare(`INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at)
    VALUES('private-token-row',?,'sensitive-token-hash','reset','2030-01-01T00:00:00Z')`).run(owner.id);

  expect((await request('/api/v1/auth/privacy/export')).status).toBe(401);
  const exportResponse = await request('/api/v1/auth/privacy/export', 'GET', undefined, owner.cookie);
  expect(exportResponse.status).toBe(200);
  expect(exportResponse.headers.get('cache-control')).toContain('no-store');
  expect(exportResponse.headers.get('content-disposition')).toContain('maia-account-export.json');
  expect(exportResponse.data).toMatchObject({
    schemaVersion: 'maia-account-export-v1',
    account: { id: owner.id, email: 'privacy-owner@example.com' },
    mediaUploads: [{ id: 'owner-media', filename: 'my-notes.txt' }],
  });
  const serialized = JSON.stringify(exportResponse.data);
  expect(serialized).not.toContain('privacy-other@example.com');
  expect(serialized).not.toContain('other-media');
  expect(serialized).not.toContain('sensitive-token-hash');
  expect(serialized).not.toContain('password_hash');
  expect(serialized).not.toContain('private-file.txt');
});

it('records an idempotent deletion request without deleting or suspending the account', async () => {
  const owner = await register('privacy-request@example.com');
  const invalid = await request('/api/v1/auth/privacy/requests', 'POST', {}, owner.cookie);
  expect(invalid.status).toBe(422);

  const first = await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, owner.cookie);
  expect(first.status).toBe(201);
  expect(first.data).toMatchObject({ requestType: 'deletion', status: 'OPEN' });
  const duplicate = await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, owner.cookie);
  expect(duplicate.status).toBe(200);
  expect(duplicate.data.id).toBe(first.data.id);

  const ownRequests = await request('/api/v1/auth/privacy/requests', 'GET', undefined, owner.cookie);
  expect(ownRequests.data).toHaveLength(1);
  expect(ownRequests.data[0]).toMatchObject({ id: first.data.id, status: 'OPEN' });
  expect((db.prepare('SELECT status FROM users WHERE id=?').get(owner.id) as { status: string }).status)
    .toBe('active');
  const requestCount = db.prepare(`SELECT count(*) AS total FROM account_privacy_requests
    WHERE user_id=?`).get(owner.id) as { total: number };
  expect(requestCount.total).toBe(1);
});