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
  db.prepare(`INSERT INTO account_email_changes(id,user_id,email,email_normalized,token_hash,expires_at,used_at)
    VALUES('owner-email-change-old',?,'old-owner-address@example.com','old-owner-address@example.com',
      'old-sensitive-email-change-token-hash','2025-01-01T00:00:00Z','2024-01-01T00:00:00Z')`).run(owner.id);
  db.prepare(`INSERT INTO account_email_changes(id,user_id,email,email_normalized,token_hash,expires_at)
    VALUES('owner-email-change-pending',?,'next-owner-address@example.com','next-owner-address@example.com',
      'pending-sensitive-email-change-token-hash','2030-01-01T00:00:00Z')`).run(owner.id);
  db.prepare(`INSERT INTO account_email_changes(id,user_id,email,email_normalized,token_hash,expires_at)
    VALUES('other-email-change',?,'private-other-target@example.com','private-other-target@example.com',
      'other-sensitive-email-change-token-hash','2030-01-01T00:00:00Z')`).run(other.id);

  expect((await request('/api/v1/auth/privacy/export')).status).toBe(401);
  const exportResponse = await request('/api/v1/auth/privacy/export', 'GET', undefined, owner.cookie);
  expect(exportResponse.status).toBe(200);
  expect(exportResponse.headers.get('cache-control')).toContain('no-store');
  expect(exportResponse.headers.get('content-disposition')).toContain('maia-account-export.json');
  expect(exportResponse.data).toMatchObject({
    schemaVersion: 'maia-account-export-v1',
    account: { id: owner.id, email: 'privacy-owner@example.com' },
    emailChanges: [
      {
        id: 'owner-email-change-old',
        email: 'old-owner-address@example.com',
        expires_at: '2025-01-01T00:00:00Z',
        used_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'owner-email-change-pending',
        email: 'next-owner-address@example.com',
        expires_at: '2030-01-01T00:00:00Z',
        used_at: null,
      },
    ],
    mediaUploads: [{ id: 'owner-media', filename: 'my-notes.txt' }],
  });
  const serialized = JSON.stringify(exportResponse.data);
  expect(serialized).not.toContain('privacy-other@example.com');
  expect(serialized).not.toContain('other-media');
  expect(serialized).not.toContain('sensitive-token-hash');
  expect(serialized).not.toContain('password_hash');
  expect(serialized).not.toContain('private-file.txt');
  expect(serialized).not.toContain('other-email-change');
  expect(serialized).not.toContain('private-other-target@example.com');
  expect(serialized).not.toContain('email-change-token-hash');
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

it('allows only admins to search, paginate and review requests with private append-only history', async () => {
  const owner = await register('review-owner@example.com');
  const other = await register('review-other@example.com');
  const admin = await register('review-admin@example.com');
  const author = await register('review-author@example.com');
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
  db.prepare("UPDATE users SET role='author' WHERE id=?").run(author.id);
  const adminCookie = (await request('/api/v1/auth/login', 'POST',
    { email: 'review-admin@example.com', password })).cookie;
  const authorCookie = (await request('/api/v1/auth/login', 'POST',
    { email: 'review-author@example.com', password })).cookie;
  const first = await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, owner.cookie);
  await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, other.cookie);
  const path = `/api/v1/admin/privacy/requests/${first.data.id}`;
  for (const [cookie, status] of [['', 401], [owner.cookie, 403], [authorCookie, 403]] as const) {
    expect((await request('/api/v1/admin/privacy/requests', 'GET', undefined, cookie)).status).toBe(status);
    expect((await request(`${path}/history`, 'GET', undefined, cookie)).status).toBe(status);
    expect((await request(`${path}/review`, 'POST', { note: 'Unauthorized review' }, cookie)).status).toBe(status);
  }
  const page = await request('/api/v1/admin/privacy/requests?limit=1&offset=1', 'GET', undefined, adminCookie);
  expect(page.data).toMatchObject({ total: 2, limit: 1, offset: 1 });
  expect(page.data.items).toHaveLength(1);
  expect(page.headers.get('cache-control')).toContain('no-store');
  const filtered = await request('/api/v1/admin/privacy/requests?q=review-owner&status=OPEN', 'GET', undefined, adminCookie);
  expect(filtered.data.total).toBe(1);
  expect(filtered.data.items[0]).toMatchObject({ id: first.data.id, email: 'review-owner@example.com' });
  expect((await request('/api/v1/admin/privacy/requests?limit=101', 'GET', undefined, adminCookie)).status).toBe(422);
  expect((await request(`${path}/review`, 'POST', { note: '  ' }, adminCookie)).status).toBe(422);
  expect((await request(`${path}/review`, 'POST', { note: 'a'.repeat(1001) }, adminCookie)).status).toBe(422);
  expect((await request('/api/v1/admin/privacy/requests/00000000-0000-4000-8000-000000000000/review',
    'POST', { note: 'Valid review note' }, adminCookie)).status).toBe(404);
  db.exec(`CREATE TRIGGER reject_privacy_review_audit BEFORE INSERT ON audit_events
    WHEN NEW.action='privacy_request.review'
    BEGIN SELECT RAISE(ABORT,'Simulated audit failure'); END;`);
  expect((await request(`${path}/review`, 'POST', { note: 'Must roll back with audit' }, adminCookie)).status).toBe(500);
  expect(db.prepare('SELECT status FROM account_privacy_requests WHERE id=?').get(first.data.id))
    .toEqual({ status: 'OPEN' });
  db.exec('DROP TRIGGER reject_privacy_review_audit');

  const reviewed = await request(`${path}/review`, 'POST', { note: '  Check retention obligations before action.  ' }, adminCookie);
  expect(reviewed.data).toMatchObject({ id: first.data.id, status: 'IN_REVIEW' });
  expect(reviewed.headers.get('cache-control')).toContain('no-store');
  expect((await request('/api/v1/admin/privacy/requests?status=IN_REVIEW', 'GET', undefined, adminCookie)).data.total).toBe(1);
  await request(`${path}/review`, 'POST', { note: 'Second private note.' }, adminCookie);
  const history = await request(`${path}/history`, 'GET', undefined, adminCookie);
  expect(history.data.items).toHaveLength(2);
  expect(history.data.items).toEqual(expect.arrayContaining([
    expect.objectContaining({
      actor_id: admin.id, action: 'privacy_request.review',
      metadata: JSON.stringify({ note: 'Check retention obligations before action.', previousStatus: 'OPEN' }),
    }),
  ]));
  expect(() => db.prepare("DELETE FROM audit_events WHERE subject_id=?").run(first.data.id)).toThrow();
  const ownRequests = await request('/api/v1/auth/privacy/requests', 'GET', undefined, owner.cookie);
  expect(ownRequests.data[0].status).toBe('IN_REVIEW');
  expect(JSON.stringify(ownRequests.data)).not.toContain('private note');
  expect((await request('/api/v1/auth/privacy/requests', 'GET', undefined, other.cookie)).data)
    .not.toContainEqual(expect.objectContaining({ id: first.data.id }));
  const exported = await request('/api/v1/auth/privacy/export', 'GET', undefined, owner.cookie);
  expect(JSON.stringify(exported.data)).not.toContain('retention obligations');
  const duplicate = await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, owner.cookie);
  expect(duplicate.data).toMatchObject({ id: first.data.id, status: 'IN_REVIEW' });
  expect((db.prepare('SELECT status FROM users WHERE id=?').get(owner.id) as { status: string }).status).toBe('active');
  db.prepare("UPDATE account_privacy_requests SET status='CLOSED' WHERE id=?").run(first.data.id);
  expect((await request(`${path}/review`, 'POST', { note: 'Must not reopen' }, adminCookie)).status).toBe(409);
  expect((await request(`${path}/history`, 'GET', undefined, adminCookie)).data.items).toHaveLength(2);
});