import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { processVideo } from '../../worker/src/video-jobs.js';
import { afterEach, beforeEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { loadConfig } from './config.js';

let directory: string;
let db: Database.Database;
let server: Server;
let base: string;
const password = 'Strong-test-password-123';
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = '',
  extra: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...extra },
    ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const data = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.text();
  return {
    status: response.status,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
    response,
  };
}
async function account(email: string, role = 'learner') {
  const registered = await request('/api/v1/auth/register', 'POST', { email, password });
  expect(registered.status).toBe(201);
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, registered.data.id);
  const login = await request('/api/v1/auth/login', 'POST', { email, password });
  expect(login.status).toBe(200);
  return { id: registered.data.id as string, cookie: login.cookie };
}
const draft = (slug: string, accessMode = 'ENROLLED_FREE') => ({
  slug,
  title: 'Curso de teste',
  summary: 'Uma introdução prática ao Maia.',
  accessMode,
  modules: [
    {
      title: 'Primeiro módulo',
      lessons: [{ title: 'Primeira aula', body: 'Conteúdo reservado', required: true }],
    },
  ],
});
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-video-test-'));
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  server = createApp(db, { ...loadConfig(), STORAGE_ROOT: directory }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  }
  db?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function chunk(id: string, cookie: string, offset: number, body: Buffer, origin?: string) {
  return fetch(`${base}/api/v1/admin/videos/${id}/chunks`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Upload-Offset': String(offset),
      Cookie: cookie,
      ...(origin ? { Origin: origin } : {}),
    },
    body,
  });
}
it('author upload is resumable, bounded, isolated and cancellable', async () => {
  const a = await account('author@video.test', 'author');
  const b = await account('other@video.test', 'author');
  const c = (await request('/api/v1/admin/courses', 'POST', draft('video-upload'), a.cookie)).data;
  const created = await request(
    '/api/v1/admin/videos',
    'POST',
    { courseId: c.id, filename: 'movie.mp4', size: 9 },
    a.cookie,
  );
  expect(created.status).toBe(201);
  const id = created.data.id;
  expect((await chunk(id, '', 0, Buffer.from('abc'))).status).toBe(401);
  expect((await chunk(id, b.cookie, 0, Buffer.from('abc'))).status).toBe(403);
  expect((await chunk(id, a.cookie, 0, Buffer.from('abc'), 'https://hostile.test')).status).toBe(
    403,
  );
  expect((await chunk(id, a.cookie, 0, Buffer.alloc(512 * 1024 + 1))).status).toBe(413);
  expect((await chunk(id, a.cookie, 0, Buffer.from('abc'))).status).toBe(200);
  expect((await chunk(id, a.cookie, 0, Buffer.from('abc'))).status).toBe(409);
  const state = await request(`/api/v1/admin/videos/${id}`, 'GET', undefined, a.cookie);
  expect(state.data.offset).toBe(3);
  expect(state.data.chunks[0].sha256).toHaveLength(64);
  const concurrent = await Promise.all([
    chunk(id, a.cookie, 3, Buffer.from('def')),
    chunk(id, a.cookie, 3, Buffer.from('def')),
  ]);
  expect(concurrent.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await request(`/api/v1/admin/videos/${id}/complete`, 'POST', {}, a.cookie)).status).toBe(
    409,
  );
  expect((await request(`/api/v1/admin/videos/${id}/cancel`, 'POST', {}, a.cookie)).status).toBe(
    200,
  );
  expect((await chunk(id, a.cookie, 3, Buffer.from('def'))).status).toBe(409);
  expect(db.prepare('SELECT * FROM video_chunks WHERE upload_id=?').all(id)).toEqual([]);
});
it.runIf(process.env.VIDEO_TEST_REAL === '1')(
  'real video converts, publishes and streams only to entitled learners; invalid files fail',
  async () => {
    const a = await account('admin@video.test', 'admin');
    const learner = await account('learner@video.test');
    const c = (await request('/api/v1/admin/courses', 'POST', draft('real-video'), a.cookie)).data;
    const sample = path.join(directory, 'sample.mp4');
    execFileSync('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=160x90:rate=10',
      '-t',
      '2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      sample,
    ]);
    const bytes = fs.readFileSync(sample);
    const video = (
      await request(
        '/api/v1/admin/videos',
        'POST',
        { courseId: c.id, filename: 'sample.mp4', size: bytes.length },
        a.cookie,
      )
    ).data;
    expect((await chunk(video.id, a.cookie, 0, bytes)).status).toBe(200);
    expect(
      (await request(`/api/v1/admin/videos/${video.id}/complete`, 'POST', {}, a.cookie)).status,
    ).toBe(200);
    const payload = {
      ...draft('real-video'),
      expectedRevisionId: c.current_revision_id,
      modules: [{ title: 'Video', lessons: [{ title: 'Watch', body: '', videoId: video.id }] }],
    };
    expect((await request(`/api/v1/admin/courses/${c.id}`, 'PUT', payload, a.cookie)).status).toBe(
      200,
    );
    expect(
      (await request(`/api/v1/admin/courses/${c.id}/publish`, 'POST', {}, a.cookie)).status,
    ).toBe(422);
    expect(await Promise.all([processVideo(db, directory), processVideo(db, directory)])).toEqual([
      true,
      false,
    ]);
    expect(
      (await request(`/api/v1/admin/videos/${video.id}`, 'GET', undefined, a.cookie)).data.status,
    ).toBe('READY');
    expect(
      (await request(`/api/v1/admin/courses/${c.id}/publish`, 'POST', {}, a.cookie)).status,
    ).toBe(200);
    const detail = (await request(`/api/v1/courses/${c.id}`)).data;
    const lesson = detail.modules[0].lessons[0];
    expect(lesson.kind).toBe('video');
    const url = `${base}/api/v1/lessons/${lesson.id}/video`;
    expect((await fetch(url)).status).toBe(403);
    expect((await fetch(url.replace('/video', '/poster'))).status).toBe(403);
    await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie);
    expect(
      (await fetch(url.replace('/video', '/poster'), { headers: { Cookie: learner.cookie } }))
        .status,
    ).toBe(200);
    const playback = await fetch(url, { headers: { Cookie: learner.cookie, Range: 'bytes=0-31' } });
    expect(playback.status).toBe(206);
    expect((await playback.arrayBuffer()).byteLength).toBe(32);
    expect(playback.headers.get('content-type')).toContain('video/mp4');
    expect((await fetch(url, { method: 'HEAD', headers: { Cookie: learner.cookie } })).status).toBe(
      200,
    );
    expect(
      (await fetch(url, { headers: { Cookie: learner.cookie, Range: 'bytes=999999999-' } })).status,
    ).toBe(416);
    db.prepare("UPDATE entitlements SET revoked_at=datetime('now')").run();
    expect(
      (await fetch(url, { headers: { Cookie: learner.cookie, Range: 'bytes=32-63' } })).status,
    ).toBe(403);
    const invalid = (
      await request(
        '/api/v1/admin/videos',
        'POST',
        { courseId: c.id, filename: 'fake.mp4', size: 4 },
        a.cookie,
      )
    ).data;
    await chunk(invalid.id, a.cookie, 0, Buffer.from('fake'));
    await request(`/api/v1/admin/videos/${invalid.id}/complete`, 'POST', {}, a.cookie);
    await processVideo(db, directory);
    expect(
      (await request(`/api/v1/admin/videos/${invalid.id}`, 'GET', undefined, a.cookie)).data.status,
    ).toBe('FAILED');
  },
  30000,
);
