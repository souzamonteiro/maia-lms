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
  db.exec(`INSERT INTO course_revisions(id,course_id,title,summary) VALUES
    ('privacy-revision','privacy-course','Owner course revision','Summary'),
    ('other-revision','other-course','Other course revision','Summary');`);
  db.prepare('UPDATE course_revisions SET image_key=? WHERE id=?')
    .run('private-owner-storage-key', 'privacy-revision');
  db.prepare('UPDATE course_revisions SET image_key=? WHERE id=?')
    .run('private-other-storage-key', 'other-revision');
  db.prepare(`INSERT INTO categories(id,slug,name,description) VALUES
    ('owner-category','owner-category','Owner category','Owner category description'),
    ('other-category','other-category','Other category','Other category description')`).run();
  db.prepare(`INSERT INTO course_revision_categories(revision_id,category_id) VALUES
    ('privacy-revision','owner-category'),('other-revision','other-category')`).run();
  db.prepare(`INSERT INTO modules(id,revision_id,sort_order,title) VALUES
    ('owner-module','privacy-revision',0,'Owner module'),
    ('other-module','other-revision',0,'Other module')`).run();
  db.prepare(`INSERT INTO lessons(id,module_id,sort_order,title,body,content_format)
    VALUES('owner-lesson','owner-module',0,'Owner lesson','Owner-authored lesson text','markdown'),
      ('other-lesson','other-module',0,'Other lesson','Other private lesson text','plain')`).run();
  db.prepare(`INSERT INTO quizzes(id,revision_id,pass_percent,max_attempts)
    VALUES('owner-quiz','privacy-revision',70,3),('other-quiz','other-revision',80,2)`).run();
  db.prepare(`INSERT INTO questions(id,quiz_id,prompt,choices_json,correct_choice_keys,points,sort_order,explanation)
    VALUES('owner-question','owner-quiz','Owner question',
      '[{"key":"yes","text":"Yes"},{"key":"no","text":"No"}]','["yes"]',2,0,'Owner explanation'),
      ('other-question','other-quiz','Other question',
      '[{"key":"a","text":"A"},{"key":"b","text":"B"}]','["b"]',1,0,'Other private explanation')`).run();
  db.prepare(`INSERT INTO assets(id,owner_id,kind,storage_key,status,metadata_json)
    VALUES('owner-legacy-asset',?,'image','private/owner/asset.png','READY','{"private":"not exported"}'),
      ('other-legacy-asset',?,'image','private/other/asset.png','READY','{}')`).run(owner.id, other.id);
  db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,media_kind)
    VALUES('owner-media',?,'privacy-course','my-notes.txt',32,'attachment'),
      ('other-media',?,'other-course','private-file.txt',16,'attachment')`).run(owner.id, other.id);
  db.prepare(`INSERT INTO course_attachments(id,revision_id,upload_id,title,description,sort_order)
    VALUES('owner-attachment','privacy-revision','owner-media','Reference notes','Course handout',0),
      ('other-attachment','other-revision','other-media','Private handout','Other course file',0)`).run();
  db.prepare(`INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key)
    VALUES('owner-order',?,'privacy-course',1200,'USD','test','owner-order-key'),
      ('other-order',?,'other-course',900,'USD','test','other-order-key')`).run(owner.id, other.id);
  db.prepare(`INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status,reason)
    VALUES('owner-refund','owner-order','private-owner-provider-ref',400,'pending','Customer requested a partial refund.'),
      ('other-refund','other-order','private-other-provider-ref',900,'approved','Other account refund reason.')`).run();
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
    authoredCourses: [{
      id: 'privacy-course',
      slug: 'privacy-course',
      status: 'DRAFT',
    }],
    authoredRevisions: [{
      id: 'privacy-revision',
      course_id: 'privacy-course',
      title: 'Owner course revision',
    }],
    authoredCourseCategories: [{
      revision_id: 'privacy-revision',
      id: 'owner-category',
      name: 'Owner category',
      description: 'Owner category description',
    }],
    authoredModules: [{ id: 'owner-module', title: 'Owner module' }],
    authoredLessons: [{
      id: 'owner-lesson',
      title: 'Owner lesson',
      body: 'Owner-authored lesson text',
    }],
    authoredAttachments: [{ id: 'owner-attachment', title: 'Reference notes' }],
    authoredQuizzes: [{ id: 'owner-quiz', pass_percent: 70 }],
    authoredQuestions: [{
      id: 'owner-question',
      correct_choice_keys: '["yes"]',
      explanation: 'Owner explanation',
    }],
    legacyAssets: [{ id: 'owner-legacy-asset', kind: 'image', status: 'READY' }],
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
    refunds: [{
      id: 'owner-refund',
      order_id: 'owner-order',
      amount_minor: 400,
      status: 'pending',
      reason: 'Customer requested a partial refund.',
    }],
    mediaAttachments: [{
      id: 'owner-attachment',
      course_id: 'privacy-course',
      revision_id: 'privacy-revision',
      revision_title: 'Owner course revision',
      upload_id: 'owner-media',
      title: 'Reference notes',
      description: 'Course handout',
      sort_order: 0,
    }],
  });
  const serialized = JSON.stringify(exportResponse.data);
  expect(serialized).not.toContain('privacy-other@example.com');
  expect(serialized).not.toContain('other-media');
  expect(serialized).not.toContain('sensitive-token-hash');
  expect(serialized).not.toContain('password_hash');
  expect(serialized).not.toContain('private-file.txt');
  expect(serialized).not.toContain('other-attachment');
  expect(serialized).not.toContain('Other course revision');
  expect(serialized).not.toContain('Private handout');
  expect(serialized).not.toContain('other-email-change');
  expect(serialized).not.toContain('private-other-target@example.com');
  expect(serialized).not.toContain('email-change-token-hash');
  expect(serialized).not.toContain('other-refund');
  expect(serialized).not.toContain('Other account refund reason.');
  expect(serialized).not.toContain('private-owner-provider-ref');
  expect(serialized).not.toContain('private-other-provider-ref');
  expect(serialized).not.toContain('other-course');
  expect(serialized).not.toContain('other-revision');
  expect(serialized).not.toContain('other-category');
  expect(serialized).not.toContain('Other category description');
  expect(serialized).not.toContain('Other private lesson text');
  expect(serialized).not.toContain('Other private explanation');
  expect(serialized).not.toContain('other-legacy-asset');
  expect(serialized).not.toContain('private-owner-storage-key');
  expect(serialized).not.toContain('private-other-storage-key');
  expect(serialized).not.toContain('private/owner/asset.png');
  expect(serialized).not.toContain('not exported');
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

it('closes a reviewed request with an audited private resolution and allows a new request afterwards', async () => {
  const owner = await register('close-owner@example.com');
  const admin = await register('close-admin@example.com');
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
  const adminCookie = (await request('/api/v1/auth/login', 'POST',
    { email: 'close-admin@example.com', password })).cookie;
  const created = await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, owner.cookie);
  const path = `/api/v1/admin/privacy/requests/${created.data.id}`;
  expect((await request(`${path}/close`, 'POST', { note: 'Unauthorized close' })).status).toBe(401);
  expect((await request(`${path}/close`, 'POST', { note: 'Unauthorized close' }, owner.cookie)).status).toBe(403);

  const premature = await request(`${path}/close`, 'POST', { note: 'Close without review' }, adminCookie);
  expect(premature.status).toBe(409);
  expect(premature.data.code).toBe('PRIVACY_REQUEST_NOT_REVIEWED');
  expect(db.prepare('SELECT status FROM account_privacy_requests WHERE id=?').get(created.data.id))
    .toEqual({ status: 'OPEN' });

  await request(`${path}/review`, 'POST', { note: 'Reviewed before resolution.' }, adminCookie);
  expect((await request(`${path}/close`, 'POST', { note: '  ' }, adminCookie)).status).toBe(422);
  expect((await request(`${path}/close`, 'POST', { note: 'a'.repeat(1001) }, adminCookie)).status).toBe(422);
  expect((await request('/api/v1/admin/privacy/requests/00000000-0000-4000-8000-000000000000/close',
    'POST', { note: 'Valid resolution note' }, adminCookie)).status).toBe(404);
  db.exec(`CREATE TRIGGER reject_privacy_close_audit BEFORE INSERT ON audit_events
    WHEN NEW.action='privacy_request.close'
    BEGIN SELECT RAISE(ABORT,'Simulated audit failure'); END;`);
  expect((await request(`${path}/close`, 'POST', { note: 'Must roll back with audit' }, adminCookie)).status).toBe(500);
  expect(db.prepare('SELECT status FROM account_privacy_requests WHERE id=?').get(created.data.id))
    .toEqual({ status: 'IN_REVIEW' });
  db.exec('DROP TRIGGER reject_privacy_close_audit');

  const closed = await request(`${path}/close`, 'POST',
    { note: '  Resolution recorded under retention review; no account data deleted.  ' }, adminCookie);
  expect(closed.status).toBe(200);
  expect(closed.data).toMatchObject({ id: created.data.id, status: 'CLOSED' });
  expect(closed.headers.get('cache-control')).toContain('no-store');
  const history = await request(`${path}/history`, 'GET', undefined, adminCookie);
  expect(history.data.items).toHaveLength(2);
  expect(history.data.items).toEqual(expect.arrayContaining([
    expect.objectContaining({
      actor_id: admin.id, action: 'privacy_request.close',
      metadata: JSON.stringify({
        note: 'Resolution recorded under retention review; no account data deleted.',
        previousStatus: 'IN_REVIEW',
      }),
    }),
  ]));

  const again = await request(`${path}/close`, 'POST', { note: 'Close once more' }, adminCookie);
  expect(again.status).toBe(409);
  expect(again.data.code).toBe('PRIVACY_REQUEST_CLOSED');
  expect((await request(`${path}/review`, 'POST', { note: 'Must not reopen closed' }, adminCookie)).status).toBe(409);

  const ownRequests = await request('/api/v1/auth/privacy/requests', 'GET', undefined, owner.cookie);
  expect(ownRequests.data[0]).toMatchObject({ id: created.data.id, status: 'CLOSED' });
  expect(JSON.stringify(ownRequests.data)).not.toContain('retention review');
  expect((db.prepare('SELECT status FROM users WHERE id=?').get(owner.id) as { status: string }).status)
    .toBe('active');
  expect(db.prepare('SELECT count(*) AS total FROM users WHERE id=?').get(owner.id))
    .toEqual({ total: 1 });

  const renewed = await request('/api/v1/auth/privacy/requests', 'POST', { requestType: 'deletion' }, owner.cookie);
  expect(renewed.status).toBe(201);
  expect(renewed.data.id).not.toBe(created.data.id);
  expect(renewed.data.status).toBe('OPEN');
  expect((await request('/api/v1/auth/privacy/requests', 'GET', undefined, owner.cookie)).data).toHaveLength(2);
});