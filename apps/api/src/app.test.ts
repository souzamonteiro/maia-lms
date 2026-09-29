import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { loadConfig } from './config.js';

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
async function publish(cookie: string, slug: string, accessMode = 'ENROLLED_FREE') {
  const created = await request('/api/v1/admin/courses', 'POST', draft(slug, accessMode), cookie);
  expect(created.status).toBe(201);
  expect(
    (await request(`/api/v1/admin/courses/${created.data.id}/publish`, 'POST', {}, cookie)).status,
  ).toBe(200);
  const detail = await request(`/api/v1/courses/${slug}`);
  return {
    id: created.data.id as string,
    lessonId: detail.data.modules[0].lessons[0].id as string,
  };
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
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  }
  db?.close();
});

describe('HTTP learning workflow', () => {
  it('serves the application and health checks', async () => {
    expect((await request('/')).data).toContain('Maia Learn');
    expect((await request('/static/app.js')).status).toBe(200);
    expect((await request('/readyz')).status).toBe(200);
  });
  it('rejects unknown accounts without a server error; queues email atomically and logs out', async () => {
    expect(
      (await request('/api/v1/auth/login', 'POST', { email: 'missing@example.com', password }))
        .status,
    ).toBe(401);
    const learner = await account('learner@example.com');
    expect(db.prepare('SELECT count(*) AS n FROM outbox').get()).toEqual({ n: 1 });
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(200);
    expect((await request('/api/v1/auth/logout', 'POST', {}, learner.cookie)).status).toBe(204);
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(401);
  });
  it('enforces publishing permissions, private lessons, idempotent enrollment and progress', async () => {
    const admin = await account('admin@example.com', 'admin');
    const learner = await account('learner@example.com');
    expect(
      (await request('/api/v1/admin/courses', 'POST', draft('forbidden'), learner.cookie)).status,
    ).toBe(403);
    const c = await publish(admin.cookie, 'private-course');
    expect((await request(`/api/v1/lessons/${c.lessonId}`)).status).toBe(403);
    const first = await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie);
    const again = await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie);
    expect(first.data.id).toBe(again.data.id);
    expect(db.prepare('SELECT count(*) AS n FROM entitlements').get()).toEqual({ n: 1 });
    expect(
      (await request(`/api/v1/lessons/${c.lessonId}`, 'GET', undefined, learner.cookie)).data.body,
    ).toBe('Conteúdo reservado');
    expect(
      (
        await request(
          `/api/v1/lessons/${c.lessonId}/progress`,
          'PUT',
          { complete: true },
          learner.cookie,
        )
      ).status,
    ).toBe(200);
    const dashboard = await request('/api/v1/me/enrollments', 'GET', undefined, learner.cookie);
    expect(dashboard.data[0].completed_lessons).toBe(1);
    const other = await publish(admin.cookie, 'other-course');
    expect(
      (
        await request(
          `/api/v1/lessons/${other.lessonId}/progress`,
          'PUT',
          { complete: true },
          learner.cookie,
        )
      ).status,
    ).toBe(403);
    db.prepare("UPDATE entitlements SET revoked_at = datetime('now')").run();
    expect(
      (await request(`/api/v1/lessons/${c.lessonId}`, 'GET', undefined, learner.cookie)).status,
    ).toBe(403);
    expect(
      (await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie)).status,
    ).toBe(403);
  });
  it('retains enrolled revision while new drafts and archived courses stay private', async () => {
    const admin = await account('admin@example.com', 'admin');
    const learner = await account('learner@example.com');
    const c = await publish(admin.cookie, 'revisions');
    await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie);
    const changed = draft('revisions');
    changed.title = 'New revision';
    expect(
      (await request(`/api/v1/admin/courses/${c.id}`, 'PUT', {...changed, expectedRevisionId: (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie)).data.current_revision_id}, admin.cookie)).status,
    ).toBe(200);
    expect((await request('/api/v1/courses/revisions')).data.title).toBe('Curso de teste');
    expect(
      (await request('/api/v1/courses/revisions', 'GET', undefined, learner.cookie)).data.title,
    ).toBe('Curso de teste');
    await request(`/api/v1/admin/courses/${c.id}/publish`, 'POST', {}, admin.cookie);
    expect((await request('/api/v1/courses/revisions')).data.title).toBe('New revision');
    await request(`/api/v1/admin/courses/${c.id}/archive`, 'POST', {}, admin.cookie);
    expect(
      (await request(`/api/v1/lessons/${c.lessonId}`, 'GET', undefined, learner.cookie)).status,
    ).toBe(200);
  });
  it('allows current OPEN_FREE lessons, blocks cross-origin mutation and invalid input', async () => {
    const admin = await account('admin@example.com', 'admin');
    const c = await publish(admin.cookie, 'open-course', 'OPEN_FREE');
    expect((await request(`/api/v1/lessons/${c.lessonId}`)).status).toBe(200);
    expect(
      (
        await request('/api/v1/admin/courses', 'POST', draft('cross-origin'), admin.cookie, {
          Origin: 'https://evil.example',
        })
      ).status,
    ).toBe(403);
    expect((await request('/api/v1/admin/courses', 'POST', {}, admin.cookie)).status).toBe(422);
    const response = await fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=x&password=y',
    });
    expect(response.status).toBe(415);
  });
  it('revokes sessions on password reset and consumes the reset token once', async () => {
    const learner = await account('learner@example.com');
    await request('/api/v1/auth/forgot-password', 'POST', { email: 'learner@example.com' });
    const mail = db.prepare("SELECT payload FROM outbox WHERE payload LIKE '%Redefina%'").get() as {
      payload: string;
    };
    const token = new URL(JSON.parse(mail.payload).text.split(' ').at(-1)).searchParams.get(
      'token',
    );
    expect(
      (
        await request('/api/v1/auth/reset-password', 'POST', {
          token,
          password: 'New-password-123',
        })
      ).status,
    ).toBe(200);
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(401);
    expect(
      (
        await request('/api/v1/auth/reset-password', 'POST', {
          token,
          password: 'Another-password-123',
        })
      ).status,
    ).toBe(400);
  });
  it('rechecks suspended accounts and role changes for existing sessions', async () => {
    const admin = await account('admin@example.com', 'admin');
    db.prepare("UPDATE users SET role = 'learner' WHERE id = ?").run(admin.id);
    expect((await request('/api/v1/admin/courses', 'GET', undefined, admin.cookie)).status).toBe(
      403,
    );
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(admin.id);
    expect((await request('/api/v1/auth/me', 'GET', undefined, admin.cookie)).status).toBe(401);
  });
  it('issues secure cookies behind the configured proxy', async () => {
    const learner = await account('learner@example.com');
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    server = createApp(db, {
      ...loadConfig(),
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://learn.maiaplatform.org',
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const result = await request(
      '/api/v1/auth/login',
      'POST',
      { email: 'learner@example.com', password },
      '',
      { 'X-Forwarded-Proto': 'https' },
    );
    expect(result.response.headers.get('set-cookie')).toContain('__Host-sid=');
    expect(result.response.headers.get('set-cookie')).toContain('Secure');
    expect(learner.id).toBeTruthy();
  });
});

describe('authoring and homepage', () => {
  it('keeps published metadata and enrollment intact while a draft is edited, and rejects stale writes', async () => {
    const admin = await account('admin@example.com', 'admin');
    const learner = await account('learner@example.com');
    const c = await publish(admin.cookie, 'stable-course', 'ENROLLED_FREE');
    const editor = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie)).data;
    const change = {...draft('future-address','OPEN_FREE'),title:'Draft only',expectedRevisionId:editor.current_revision_id};
    const saved = await request(`/api/v1/admin/courses/${c.id}`,'PUT',change,admin.cookie);
    expect(saved.status).toBe(200);
    const publicView = (await request('/api/v1/courses/stable-course')).data;
    expect(publicView.title).toBe('Curso de teste');
    expect(publicView.access_mode).toBe('ENROLLED_FREE');
    expect((await request('/api/v1/courses/future-address')).status).toBe(404);
    const newDraft = (await request(`/api/v1/admin/courses/${c.id}`,'GET',undefined,admin.cookie)).data;
    expect(newDraft.slug).toBe('future-address');
    const newLesson = newDraft.modules[0].lessons[0].id;
    expect((await request(`/api/v1/lessons/${newLesson}`)).status).toBe(403);
    const enrolled = await request(`/api/v1/courses/${c.id}/enroll`,'POST',{},learner.cookie);
    expect(enrolled.data.revision_id).toBe(editor.current_revision_id);
    expect((await request(`/api/v1/admin/courses/${c.id}`,'PUT',change,admin.cookie)).status).toBe(409);
    expect((await request(`/api/v1/admin/courses/${c.id}/publish`,'POST',{expectedRevisionId:editor.current_revision_id},admin.cookie)).status).toBe(409);
    expect((await request(`/api/v1/admin/courses/${c.id}/publish`,'POST',{expectedRevisionId:saved.data.current_revision_id},admin.cookie)).status).toBe(200);
    expect((await request('/api/v1/courses/future-address')).data.title).toBe('Draft only');
    expect((await request(`/api/v1/lessons/${newLesson}`)).status).toBe(200);
    expect((await request(`/api/v1/courses/${c.id}`,'GET',undefined,learner.cookie)).data.title).toBe('Curso de teste');
  });
  it('restricts draft reading, writes and previews to the owner or administrator',async()=>{
    const admin=await account('admin@example.com','admin');
    const author=await account('author@example.com','author');
    const learner=await account('learner@example.com');
    const c=await publish(admin.cookie,'owned-course');
    expect((await request(`/api/v1/admin/courses/${c.id}`,'GET',undefined,author.cookie)).status).toBe(403);
    expect((await request('/api/v1/admin/content/preview','POST',{body:'**bold**',contentFormat:'markdown'},learner.cookie)).status).toBe(403);
    const preview=await request('/api/v1/admin/content/preview','POST',{body:'**bold**',contentFormat:'markdown'},author.cookie);
    expect(preview.data.html).toContain('<strong>bold</strong>');
    const revision=(await request(`/api/v1/admin/courses/${c.id}`,'GET',undefined,admin.cookie)).data.current_revision_id;
    expect((await request(`/api/v1/admin/courses/${c.id}`,'PUT',{...draft('owned-course'),expectedRevisionId:revision},author.cookie)).status).toBe(403);
  });
  it('serves the same safe Markdown in the preview and a published lesson',async()=>{
    const admin=await account('admin@example.com','admin');
    const data=draft('markdown-course','OPEN_FREE');
    const lesson={...data.modules[0].lessons[0],body:'# Title\n\n**Text**\n\n<script>alert(1)</script>',contentFormat:'markdown',renderPolicyVersion:999};
    const created=await request('/api/v1/admin/courses','POST',{...data,modules:[{title:'Module',lessons:[lesson]}]},admin.cookie);
    await request(`/api/v1/admin/courses/${created.data.id}/publish`,'POST',{},admin.cookie);
    const detail=(await request('/api/v1/courses/markdown-course')).data;
    const result=await request(`/api/v1/lessons/${detail.modules[0].lessons[0].id}`);
    const preview=await request('/api/v1/admin/content/preview','POST',lesson,admin.cookie);
    expect(result.data.body_html).toBe(preview.data.html);
    expect(preview.data.renderPolicyVersion).toBe(1);
    expect(result.data.render_policy_version).toBe(1);
    expect(detail.modules[0].lessons[0].render_policy_version).toBe(1);
    expect(result.data.body_html).toContain('<h1>Title</h1>');
    expect(result.data.body_html).not.toContain('<script>');
  });
  it('curates home independently from the catalog, with scheduling and optimistic concurrency',async()=>{
    const admin=await account('admin@example.com','admin');
    const author=await account('author@example.com','author');
    const first=await publish(admin.cookie,'first-home');
    const second=await publish(admin.cookie,'second-home');
    const third=await publish(admin.cookie,'third-home');
    const date=offset=>new Date(Date.now()+offset).toISOString();
    const placement=(courseId:string,priority:number,slot='featured',startsAt=date(-3600000),endsAt:string|null=null)=>({courseId,priority,slot,startsAt,endsAt});
    const data={expectedVersion:0,items:[placement(first.id,5),placement(second.id,1),placement(third.id,0,'hero',date(3600000)),placement(third.id,0,'recommended',date(-7200000),date(-3600000))]};
    expect((await request('/api/v1/admin/home','PUT',data,author.cookie)).status).toBe(403);
    expect((await request('/api/v1/admin/home','PUT',data,admin.cookie)).status).toBe(200);
    const selected=(await request('/api/v1/home')).data;
    expect(selected.featured.map(c=>c.id)).toEqual([second.id,first.id]);
    expect(selected.hero).toEqual([]);expect(selected.recommended).toEqual([]);
    expect((await request('/api/v1/admin/home','PUT',data,admin.cookie)).status).toBe(409);
    const draftOnly=(await request('/api/v1/admin/courses','POST',draft('draft-only'),admin.cookie)).data;
    expect((await request('/api/v1/admin/home','PUT',{expectedVersion:1,items:[placement(draftOnly.id,0)]},admin.cookie)).status).toBe(422);
    expect((await request('/api/v1/admin/home','GET',undefined,admin.cookie)).data.version).toBe(1);
    await request(`/api/v1/admin/courses/${second.id}/archive`,'POST',{},admin.cookie);
    expect((await request('/api/v1/home')).data.featured.map(c=>c.id)).toEqual([first.id]);
    await request('/api/v1/admin/home','PUT',{expectedVersion:1,items:[]},admin.cookie);
    expect((await request('/api/v1/home')).data.featured).toEqual([]);
    expect((await request('/api/v1/courses')).data.map(c=>c.id)).toContain(first.id);
  });
});

it('does not spend the credential-attempt limit on normal page session lookups',async()=>{
  const learner=await account('reader@example.com');
  for(let i=0;i<22;i++)expect((await request('/api/v1/auth/me','GET',undefined,learner.cookie)).status).toBe(200);
  expect((await request('/api/v1/auth/login','POST',{email:'reader@example.com',password})).status).toBe(200);
});
it('still limits repeated credential attempts',async()=>{
  for(let i=0;i<20;i++)expect((await request('/api/v1/auth/login','POST',{})).status).toBe(422);
  expect((await request('/api/v1/auth/login','POST',{})).status).toBe(429);
});
