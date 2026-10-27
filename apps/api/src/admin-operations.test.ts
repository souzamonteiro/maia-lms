import Database from 'better-sqlite3';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { statfsSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';
import { recordPlaybackMetric } from './services/playback-metrics.js';

vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, statfsSync: vi.fn(fs.statfsSync) };
});

let db: Database.Database;
let server: Server;
let base: string;
const password = 'Operations-test-password-123';
async function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  return {
    status: response.status,
    data: response.headers.get('content-type')?.includes('json') ? await response.json() : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}

async function account(email: string, role: string) {
  const registered = await request('/api/v1/auth/register', 'POST', { email, password });
  expect(registered.status).toBe(201);
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, registered.data.id);
  const login = await request('/api/v1/auth/login', 'POST', { email, password });
  expect(login.status).toBe(200);
  return login.cookie;
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
  vi.mocked(statfsSync).mockReset();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()),
  );
  db.close();
});

it('distinguishes unavailable capacity from low space and clears the alert after recovery', async () => {
  const cookie = await account('storage-admin@example.com', 'admin');
  db.exec(`INSERT INTO worker_instances(instance_id,started_at,heartbeat_at)
    VALUES('healthy-storage-worker',datetime('now'),datetime('now'));`);
  const summary = () => request('/api/v1/admin/operations', 'GET', undefined, cookie);
  for (const code of ['ENOENT', 'EACCES']) {
    vi.mocked(statfsSync).mockImplementationOnce(() => {
      throw new Error(`${code}: /private/storage/path token=do-not-expose`);
    });
    const result = await summary();
    expect(result.status).toBe(200);
    expect(result.data.storage).toBeNull();
    expect(result.data.alerts).toEqual(['STORAGE_UNAVAILABLE']);
    expect(result.data.workers).toHaveLength(1);
    expect(JSON.stringify(result.data)).not.toMatch(/private\/storage|do-not-expose|ENOENT|EACCES/);
  }
  for (const [available, alerts] of [[9, ['STORAGE_LOW']], [10, []], [11, []]] as const) {
    vi.mocked(statfsSync).mockReturnValueOnce({
      type: 0, bsize: 1024, blocks: 100, bfree: 15, bavail: available, files: 100, ffree: 50,
    });
    const result = await summary();
    expect(result.data.storage).toEqual({ availableBytes: available * 1024, totalBytes: 100 * 1024 });
    expect(result.data.alerts).toEqual(alerts);
  }
});

it('summarizes operational state for admins without exposing payloads or identities', async () => {
  const adminCookie = await account('operations-admin@example.com', 'admin');
  const authorCookie = await account('operations-author@example.com', 'author');
  expect((await request('/api/v1/admin/operations')).status).toBe(401);
  expect((await request('/api/v1/admin/operations', 'GET', undefined, authorCookie)).status)
    .toBe(403);

  db.exec(`INSERT INTO courses(id,slug,author_id) SELECT 'ops-course','ops-course',id
    FROM users WHERE email='operations-admin@example.com'`);
  db.prepare(`INSERT INTO video_uploads(id,owner_id,course_id,filename,size,status,media_kind,error)
    VALUES('ops-video',(SELECT id FROM users WHERE email='operations-admin@example.com'),
      'ops-course','private-name.mp4',10,'FAILED','video','VIDEO_PROCESSING_FAILED')`).run();
  db.prepare(`INSERT INTO outbox(id,event_type,payload,attempts,last_error)
    VALUES('ops-outbox','email.send',?,5,?)`)
    .run(JSON.stringify({ to: 'private@example.com', token: 'secret-token' }), 'private error');
  db.exec(`INSERT INTO worker_instances(instance_id,started_at,heartbeat_at)
      VALUES('worker-current',datetime('now'),datetime('now'));
    INSERT INTO worker_instances(instance_id,started_at,heartbeat_at)
      VALUES('worker-stale',datetime('now','-5 minutes'),datetime('now','-2 minutes'));
    INSERT INTO worker_instances(instance_id,started_at,heartbeat_at,stopped_at)
      VALUES('worker-stopped',datetime('now','-1 hour'),datetime('now','-1 hour'),datetime('now','-1 hour'));`);
  db.prepare(`INSERT INTO playback_metrics_daily(metric_date,resource_type,status_class,request_count)
    VALUES(date('now'),'mp4',2,8),(date('now'),'hls_segment',4,2)`).run();

  const result = await request('/api/v1/admin/operations', 'GET', undefined, adminCookie);
  expect(result.status).toBe(200);
  expect(result.data).toMatchObject({
    media: { byStatus: { FAILED: 1 }, stuck: 0 },
    outbox: { exhausted: 1, emailExhausted: 1 },
    playback: {
      windowDays: 7,
      requests: 10,
      byResource: { mp4: 8, hls_segment: 2 },
      byStatusClass: { '2': 8, '4': 2 },
      responseDuration: { measuredRequests: 0, averageMs: null },
    },
    alerts: ['MEDIA_JOB_FAILED', 'OUTBOX_EXHAUSTED'],
  });

  expect(result.data.workers.map((worker: { status: string }) => worker.status).sort())
    .toEqual(['healthy', 'stale', 'stopped']);
  expect(result.data.storage).toMatchObject({ availableBytes: expect.any(Number), totalBytes: expect.any(Number) });
  const serialized = JSON.stringify(result.data);
  expect(serialized).not.toContain('private@example.com');
  expect(serialized).not.toContain('secret-token');
  expect(serialized).not.toContain('private-name.mp4');
  expect(serialized).not.toContain('private error');
});

it('reports a weighted duration average for measured responses within the seven-day window only', async () => {
  const cookie = await account('duration-admin@example.com', 'admin');
  const getSummary = () => request('/api/v1/admin/operations', 'GET', undefined, cookie);
  expect((await getSummary()).data.playback.responseDuration)
    .toEqual({ measuredRequests: 0, averageMs: null });
  const today = new Date();
  const sixDaysAgo = new Date(today.getTime() - 6 * 86400_000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400_000);
  const tomorrow = new Date(today.getTime() + 86400_000);
  recordPlaybackMetric(db, 'mp4', 206, today);
  recordPlaybackMetric(db, 'mp4', 206, today, 100);
  recordPlaybackMetric(db, 'mp4', 206, today, 300);
  recordPlaybackMetric(db, 'hls_segment', 403, sixDaysAgo, 50);
  recordPlaybackMetric(db, 'mp4', 200, sevenDaysAgo, 9999);
  recordPlaybackMetric(db, 'mp4', 200, tomorrow, 9999);
  expect((await getSummary()).data.playback).toMatchObject({
    requests: 4,
    byResource: { mp4: 3, hls_segment: 1 },
    responseDuration: { measuredRequests: 3, averageMs: 150 },
  });
});

it('aggregates email transport attempts and weighted duration over seven UTC dates', async () => {
  const cookie = await account('email-metrics-admin@example.com', 'admin');
  const summary = async () => (await request('/api/v1/admin/operations', 'GET', undefined, cookie)).data;
  const initial = await summary();
  expect(initial).toMatchObject({
    emailTransport: { windowDays: 7, attempts: 0, accepted: 0, failed: 0, averageMs: null },
    alerts: expect.not.arrayContaining(['EMAIL_TRANSPORT_FAILED']),
  });
  db.exec(`INSERT INTO email_transport_metrics_daily VALUES
    (date('now'),'accepted',2,100),
    (date('now','-6 days'),'failed',1,200),
    (date('now','-7 days'),'accepted',10,9999),
    (date('now','+1 day'),'failed',10,9999);`);
  const withFailures = await summary();
  expect(withFailures.emailTransport)
    .toEqual({ windowDays: 7, attempts: 3, accepted: 2, failed: 1, averageMs: 100 });
  expect(withFailures.alerts).toContain('EMAIL_TRANSPORT_FAILED');
  db.prepare(`DELETE FROM email_transport_metrics_daily WHERE outcome='failed'`).run();
  const recovered = await summary();
  expect(recovered.alerts).not.toContain('EMAIL_TRANSPORT_FAILED');
});

it('aggregates payment reconciliation checks over the seven-day UTC window', async () => {
  const cookie = await account('payment-metrics-admin@example.com', 'admin');
  const summary = async () => (await request('/api/v1/admin/operations', 'GET', undefined, cookie)).data.paymentReconciliation;
  expect(await summary()).toEqual({ windowDays: 7, checks: 0, reconciled: 0, failed: 0, averageMs: null });
  db.exec(`INSERT INTO payment_reconciliation_metrics_daily VALUES
    (date('now'),'reconciled',2,100),
    (date('now','-6 days'),'failed',1,200),
    (date('now','-7 days'),'reconciled',10,9999),
    (date('now','+1 day'),'failed',10,9999);`);
  expect(await summary()).toEqual({ windowDays: 7, checks: 3, reconciled: 2, failed: 1, averageMs: 100 });
  const alerts = (await request('/api/v1/admin/operations', 'GET', undefined, cookie)).data.alerts as string[];
  expect(alerts).toContain('PAYMENT_RECONCILIATION_FAILED');
  db.prepare(`DELETE FROM payment_reconciliation_metrics_daily WHERE outcome='failed'`).run();
  const recoveredAlerts = (await request('/api/v1/admin/operations', 'GET', undefined, cookie)).data.alerts as string[];
  expect(recoveredAlerts).not.toContain('PAYMENT_RECONCILIATION_FAILED');
});

it('reports ready queue count and delay using worker eligibility without exposing message data', async () => {
    const cookie = await account('queue-admin@example.com', 'admin');
    db.exec(`UPDATE outbox SET attempts=attempts+1,lease_token='fixture-claim' WHERE processed_at IS NULL;
      UPDATE outbox SET processed_at=datetime('now'),lease_token=NULL WHERE processed_at IS NULL;`);
    const summary = async () => (await request('/api/v1/admin/operations', 'GET', undefined, cookie)).data.outbox;
    expect(await summary()).toMatchObject({ ready: 0, oldestReadyDelaySeconds: null });
    db.exec(`INSERT INTO outbox(id,event_type,payload,attempts,available_at,processed_at,lease_token) VALUES
      ('ready','email.send','{}',0,datetime('now','-120 seconds'),NULL,NULL),
      ('expired-lease','certificate.generate','{}',1,datetime('now','-300 seconds'),NULL,'expired'),
      ('future','email.send','{}',0,datetime('now','+1 hour'),NULL,NULL),
      ('leased','email.send','{}',1,datetime('now','+5 minutes'),NULL,'active'),
      ('exhausted','email.send','{}',5,datetime('now','-1 day'),NULL,NULL),
      ('processed','email.send','{}',1,datetime('now','-2 days'),datetime('now'),NULL);`);
    const queue = await summary();
    expect(queue).toMatchObject({ pending: 4, ready: 2 });
    expect(queue.oldestReadyDelaySeconds).toBeGreaterThanOrEqual(300);
    expect(queue.oldestReadyDelaySeconds).toBeLessThan(305);
    db.exec(`UPDATE outbox SET attempts=attempts+1,lease_token='fixture-complete' WHERE id IN ('ready','expired-lease');
      UPDATE outbox SET processed_at=datetime('now'),lease_token=NULL WHERE id IN ('ready','expired-lease');`);
    expect(await summary()).toMatchObject({ pending: 2, ready: 0, oldestReadyDelaySeconds: null });
    db.exec("INSERT INTO outbox(id,event_type,payload,available_at) VALUES('just-ready','email.send','{}',datetime('now'))");
    const justReady = await summary();
    expect(justReady.ready).toBe(1);
    expect(justReady.oldestReadyDelaySeconds).toBeGreaterThanOrEqual(0);
    expect(justReady.oldestReadyDelaySeconds).toBeLessThan(5);
});