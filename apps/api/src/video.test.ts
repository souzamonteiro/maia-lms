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
    ...(!['GET', 'HEAD'].includes(method) ? { body: JSON.stringify(body ?? {}) } : {}),
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
  db.prepare("UPDATE video_uploads SET last_activity_at=datetime('now','-8 days') WHERE id=?").run(id);
  expect((await chunk(id, a.cookie, 0, Buffer.from('abc'))).status).toBe(200);
  expect((db.prepare("SELECT julianday(last_activity_at)>julianday('now','-1 minute') AS fresh FROM video_uploads WHERE id=?").get(id) as {fresh:number}).fresh).toBe(1);
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
      modules: [
        {
          title: 'Video',
          lessons: [
            {
              title: 'Watch',
              body: '',
              videoId: video.id,
              captions: [
                {
                  language: 'en',
                  label: 'English',
                  vtt: 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello world',
                },
              ],
            },
          ],
        },
      ],
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
    const captionUrl = url.replace('/video', '/captions/en');
    expect((await fetch(captionUrl)).status).toBe(403);
    expect((await fetch(url.replace('/video', '/poster'))).status).toBe(403);
    await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie);
    expect(
      (await fetch(url.replace('/video', '/poster'), { headers: { Cookie: learner.cookie } }))
        .status,
    ).toBe(200);
    const captions = await fetch(captionUrl, { headers: { Cookie: learner.cookie } });
    expect(captions.status).toBe(200);
    expect(captions.headers.get('content-type')).toContain('text/vtt');
    expect(await captions.text()).toContain('Hello world');
    const beforeEdit = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, a.cookie))
      .data;
    const edited = await request(
      `/api/v1/admin/courses/${c.id}`,
      'PUT',
      {
        ...payload,
        expectedRevisionId: beforeEdit.current_revision_id,
        modules: [
          {
            title: 'Video',
            lessons: [
              {
                title: 'Watch',
                body: '',
                videoId: video.id,
                captions: [
                  {
                    language: 'en',
                    label: 'English',
                    vtt: 'WEBVTT\n\n00:00.000 --> 00:02.000\nNew captions',
                  },
                ],
              },
            ],
          },
        ],
      },
      a.cookie,
    );
    expect(edited.status).toBe(200);
    await request(`/api/v1/admin/courses/${c.id}/publish`, 'POST', {}, a.cookie);
    const updated = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, a.cookie))
      .data;
    const newLesson = updated.modules[0].lessons[0].id;
    expect(
      (
        await fetch(`${base}/api/v1/lessons/${newLesson}/captions/en`, {
          headers: { Cookie: learner.cookie },
        })
      ).status,
    ).toBe(403);
    expect(
      await (await fetch(captionUrl, { headers: { Cookie: learner.cookie } })).text(),
    ).toContain('Hello world');
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
    expect((await fetch(captionUrl, { headers: { Cookie: learner.cookie } })).status).toBe(403);
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
it('materials preserve revisions and authorize downloads, including preview and revocation', async () => {
  const author = await account('materials@tests.test', 'admin');
  const learner = await account('reader@tests.test');
  const course = (await request('/api/v1/admin/courses', 'POST', draft('materials'), author.cookie))
    .data;
  const source = Buffer.from('export const answer = 42;\n');
  const upload = (
    await request(
      '/api/v1/admin/files',
      'POST',
      { courseId: course.id, filename: 'example.ts', size: source.length },
      author.cookie,
    )
  ).data;
  expect(
    (await request(`/api/v1/admin/videos/${upload.id}`, 'GET', undefined, author.cookie)).status,
  ).toBe(404);
  expect(
    (
      await fetch(`${base}/api/v1/admin/files/${upload.id}/chunks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Upload-Offset': '0',
          Cookie: author.cookie,
        },
        body: source,
      })
    ).status,
  ).toBe(200);
  await request(`/api/v1/admin/files/${upload.id}/complete`, 'POST', {}, author.cookie);
  const attachment = {
    fileId: upload.id,
    title: 'Source code',
    description: 'Complete example for this lesson.',
  };
  const payload = {
    ...draft('materials'),
    expectedRevisionId: course.current_revision_id,
    attachments: [attachment],
    modules: [
      {
        title: 'Module',
        lessons: [{ title: 'Lesson', body: 'Read the example', attachments: [attachment] }],
      },
    ],
  };
  expect(
    (await request(`/api/v1/admin/courses/${course.id}`, 'PUT', payload, author.cookie)).status,
  ).toBe(200);
  expect(
    (await request(`/api/v1/admin/courses/${course.id}/publish`, 'POST', {}, author.cookie)).data
      .code,
  ).toBe('FILE_NOT_READY');
  await processVideo(db, directory);
  expect(
    (await request(`/api/v1/admin/files/${upload.id}`, 'GET', undefined, author.cookie)).data
      .status,
  ).toBe('READY');
  expect(
    (await request(`/api/v1/admin/courses/${course.id}/publish`, 'POST', {}, author.cookie)).status,
  ).toBe(200);
  const detail = (await request(`/api/v1/courses/${course.id}`)).data;
  const courseFile = detail.attachments[0].id;
  const lessonId = detail.modules[0].lessons[0].id;
  const download = (id: string, cookie = '') =>
    fetch(`${base}/api/v1/attachments/${id}/download`, { headers: { Cookie: cookie } });
  expect((await download(courseFile)).status).toBe(403);
  await request(`/api/v1/courses/${course.id}/enroll`, 'POST', {}, learner.cookie);
  const lesson = (await request(`/api/v1/lessons/${lessonId}`, 'GET', undefined, learner.cookie))
    .data;
  const received = await download(lesson.attachments[0].id, learner.cookie);
  expect(received.headers.get('content-disposition')).toContain('attachment;');
  expect(received.headers.get('content-type')).toContain('application/octet-stream');
  expect(await received.text()).toBe(source.toString());
  const current = (
    await request(`/api/v1/admin/courses/${course.id}`, 'GET', undefined, author.cookie)
  ).data;
  await request(
    `/api/v1/admin/courses/${course.id}`,
    'PUT',
    { ...draft('materials'), expectedRevisionId: current.current_revision_id },
    author.cookie,
  );
  await request(`/api/v1/admin/courses/${course.id}/publish`, 'POST', {}, author.cookie);
  expect((await download(courseFile, learner.cookie)).status).toBe(200);
  db.prepare("UPDATE entitlements SET revoked_at=datetime('now')").run();
  expect((await download(courseFile, learner.cookie)).status).toBe(403);
  const other = (
    await request('/api/v1/admin/courses', 'POST', draft('other-materials'), author.cookie)
  ).data;
  expect(
    (
      await request(
        `/api/v1/admin/courses/${other.id}`,
        'PUT',
        {
          ...draft('other-materials'),
          expectedRevisionId: other.current_revision_id,
          attachments: [attachment],
        },
        author.cookie,
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await request(
        '/api/v1/admin/files',
        'POST',
        { courseId: course.id, filename: 'program.exe', size: 10 },
        author.cookie,
      )
    ).status,
  ).toBe(422);
});

it('keeps covers revision-bound, requires ready images and alt text, and protects unpublished images', async () => {
  const admin = await account('cover-admin@example.com', 'admin');
  const other = await account('cover-other@example.com', 'author');
  const learner = await account('cover-student@example.com');
  const course = (await request('/api/v1/admin/courses','POST',draft('covers'),admin.cookie)).data;
  const upload = (await request('/api/v1/admin/files','POST',{courseId:course.id,filename:'cover.png',size:8},admin.cookie)).data;
  fs.mkdirSync(path.join(directory,'covers'));
  fs.writeFileSync(path.join(directory,'covers','test'),Buffer.from([137,80,78,71,13,10,26,10]));
  db.prepare("UPDATE video_uploads SET status='READY',output_key='covers/test' WHERE id=?").run(upload.id);
  let saved = (await request(`/api/v1/admin/courses/${course.id}`,'PUT',{...draft('covers'),coverFileId:upload.id,expectedRevisionId:course.current_revision_id},admin.cookie)).data;
  expect((await request(`/api/v1/admin/courses/${course.id}/publish`,'POST',{},admin.cookie)).data.code).toBe('COVER_INVALID');
  saved = (await request(`/api/v1/admin/courses/${course.id}`,'PATCH',{expectedRevisionId:saved.current_revision_id,changes:[{unit:'course',value:{...draft('covers'),coverFileId:upload.id,coverAlt:'Accessible cover'}}]},admin.cookie)).data;
  const coverPath = `/api/v1/courses/${course.id}/cover?revisionId=${saved.current_revision_id}`;
  expect((await request(coverPath)).status).toBe(404);
  expect((await request(coverPath,'GET',undefined,other.cookie)).status).toBe(404);
  expect((await request(coverPath,'HEAD',undefined,admin.cookie)).status).toBe(200);
  await request(`/api/v1/admin/courses/${course.id}/publish`,'POST',{},admin.cookie);
  expect((await request(coverPath)).response.headers.get('content-type')).toContain('image/png');
  await request(`/api/v1/courses/${course.id}/enroll`,'POST',{},learner.cookie);
  const next = (await request(`/api/v1/admin/courses/${course.id}`,'PUT',{...draft('covers'),expectedRevisionId:saved.current_revision_id},admin.cookie)).data;
  expect((await request(`/api/v1/courses/${course.id}`)).data.cover_file_id).toBe(upload.id);
  await request(`/api/v1/admin/courses/${course.id}/publish`,'POST',{},admin.cookie);
  expect((await request(coverPath)).status).toBe(404);
  expect((await request(coverPath,'GET',undefined,learner.cookie)).status).toBe(200);
  expect(next.current_revision_id).not.toBe(saved.current_revision_id);
  const foreign = (await request('/api/v1/admin/courses','POST',draft('foreign-cover'),other.cookie)).data;
  expect((await request(`/api/v1/admin/courses/${foreign.id}`,'PUT',{...draft('foreign-cover'),coverFileId:upload.id,expectedRevisionId:foreign.current_revision_id},other.cookie)).status).toBe(422);
});

it('publishes only the revision trailer with Range support without exposing private lessons', async () => {
  const admin = await account('trailer-admin@example.com','admin');
  const other = await account('trailer-other@example.com','author');
  const course = (await request('/api/v1/admin/courses','POST',draft('trailers'),admin.cookie)).data;
  const upload = (await request('/api/v1/admin/videos','POST',{courseId:course.id,filename:'trailer.mp4',size:10},admin.cookie)).data;
  let saved = (await request(`/api/v1/admin/courses/${course.id}`,'PUT',{...draft('trailers'),trailerVideoId:upload.id,expectedRevisionId:course.current_revision_id},admin.cookie)).data;
  expect((await request(`/api/v1/admin/courses/${course.id}/publish`,'POST',{},admin.cookie)).data.code).toBe('TRAILER_INVALID');
  fs.mkdirSync(path.join(directory,'trailers'));
  fs.writeFileSync(path.join(directory,'trailers','movie'),'0123456789');
  fs.writeFileSync(path.join(directory,'trailers','poster'),'poster');
  db.prepare("UPDATE video_uploads SET status='READY',output_key='trailers/movie',poster_key='trailers/poster' WHERE id=?").run(upload.id);
  const url = `/api/v1/courses/${course.id}/trailer?revisionId=${saved.current_revision_id}`;
  expect((await request(url)).status).toBe(403);
  expect((await request(url,'GET',undefined,other.cookie)).status).toBe(403);
  expect((await request(url,'HEAD',undefined,admin.cookie)).status).toBe(200);
  await request(`/api/v1/admin/courses/${course.id}/publish`,'POST',{},admin.cookie);
  const range = await request(url,'GET',undefined,'',{Range:'bytes=2-4'});
  expect(range.status).toBe(206);
  expect(range.data).toBe('234');
  expect((await request(url,'GET',undefined,'',{Range:'bytes=20-30'})).status).toBe(416);
  expect((await request(`/api/v1/courses/${course.id}/trailer/poster`)).status).toBe(200);
  const detail = (await request(`/api/v1/courses/${course.id}`)).data;
  expect((await request(`/api/v1/lessons/${detail.modules[0].lessons[0].id}`)).status).toBe(403);
  saved = (await request(`/api/v1/admin/courses/${course.id}`,'PUT',{...draft('trailers'),expectedRevisionId:saved.current_revision_id},admin.cookie)).data;
  expect((await request(url)).status).toBe(200);
  await request(`/api/v1/admin/courses/${course.id}/publish`,'POST',{},admin.cookie);
  expect((await request(url)).status).toBe(403);
  expect((await request(`/api/v1/courses/${course.id}/trailer`)).status).toBe(404);
  const foreign = (await request('/api/v1/admin/courses','POST',draft('foreign-trailer'),other.cookie)).data;
  expect((await request(`/api/v1/admin/courses/${foreign.id}`,'PUT',{...draft('foreign-trailer'),trailerVideoId:upload.id,expectedRevisionId:foreign.current_revision_id},other.cookie)).status).toBe(422);
});
