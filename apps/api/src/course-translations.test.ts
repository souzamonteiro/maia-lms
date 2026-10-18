import Database from 'better-sqlite3';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';

let db: Database.Database;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let base: string;
const password = 'Translations-test-password-123';

async function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  return {
    status: response.status,
    data: response.headers.get('content-type')?.includes('json')
      ? await response.json()
      : await response.text(),
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}

async function adminAccount(email: string) {
  const registered = await request('/api/v1/auth/register', 'POST', { email, password });
  expect(registered.status).toBe(201);
  db.prepare('UPDATE users SET role=? WHERE id=?').run('admin', registered.data.id);
  const signedIn = await request('/api/v1/auth/login', 'POST', { email, password });
  expect(signedIn.status).toBe(200);
  return signedIn.cookie;
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
      server.close(error => error ? reject(error) : resolve()),
    );
  }
  db?.close();
});

it('localizes revision metadata per field, falls back to source text, and freezes published translations', async () => {
  const cookie = await adminAccount('course-translation-admin@example.com');
  const course = await request('/api/v1/admin/courses', 'POST', {
    slug: 'curso-com-traducoes',
    title: 'Curso original',
    summary: 'Descrição original para fallback.',
    locale: 'pt-BR',
    accessMode: 'OPEN_FREE',
    translations: [{ locale: 'es', title: 'Curso traducido' }],
    modules: [{ title: 'Módulo', lessons: [{ title: 'Aula', body: 'Texto', required: true }] }],
  }, cookie);
  expect(course.status).toBe(201);
  expect((await request(`/api/v1/admin/courses/${course.data.id}`, 'GET', undefined, cookie)).data)
    .toMatchObject({ locale: 'pt-BR', translations: [{ locale: 'es', title: 'Curso traducido' }] });
  expect((await request(`/api/v1/admin/courses/${course.data.id}/publish`, 'POST', {}, cookie)).status)
    .toBe(200);
  db.prepare(`INSERT INTO promotions(id,slot,course_id,starts_at,priority)
    VALUES('translation-promotion','hero',?,'2000-01-01T00:00:00.000Z',0)`).run(course.data.id);

  const spanishDetail = await request('/api/v1/courses/curso-com-traducoes?displayLocale=es');
  expect(spanishDetail.status).toBe(200);
  expect(spanishDetail.data).toMatchObject({
    title: 'Curso traducido',
    summary: 'Descrição original para fallback.',
    locale: 'pt-BR',
    display_locale: 'es',
  });
  expect(spanishDetail.data).not.toHaveProperty('translations_json');

  const englishFallback = await request('/api/v1/courses/curso-com-traducoes?displayLocale=en');
  expect(englishFallback.data).toMatchObject({
    title: 'Curso original',
    summary: 'Descrição original para fallback.',
    display_locale: 'en',
  });
  const searched = await request('/api/v1/courses?displayLocale=es&q=Curso%20traducido');
  expect(searched.data).toHaveLength(1);
  expect(searched.data[0]).toMatchObject({ title: 'Curso traducido', locale: 'pt-BR' });
  const home = await request('/api/v1/home?displayLocale=es');
  expect(home.data.hero[0]).toMatchObject({ title: 'Curso traducido', summary: 'Descrição original para fallback.', locale: 'pt-BR' });
  const adminId = db.prepare('SELECT id FROM users WHERE email=?')
    .get('course-translation-admin@example.com').id;
  db.prepare(`INSERT INTO instructor_profiles(user_id,slug,display_name,bio,is_public)
    VALUES(?,?,?,?,1)`).run(adminId, 'translation-author', 'Autora', 'Perfil original');
  const profile = await request('/api/v1/instructors/translation-author?displayLocale=es');
  expect(profile.data.courses[0]).toMatchObject({
    title: 'Curso traducido',
    locale: 'pt-BR',
  });

  expect((await request(`/api/v1/courses/${course.data.id}/enroll`, 'POST', {}, cookie)).status)
    .toBe(200);
  const learning = await request('/api/v1/me/enrollments?displayLocale=es', 'GET', undefined, cookie);
  expect(learning.data[0]).toMatchObject({
    slug: 'curso-com-traducoes',
    title: 'Curso traducido',
    locale: 'pt-BR',
    display_locale: 'es',
  });

  const revisionId = course.data.current_revision_id;
  expect(() => db.prepare('UPDATE course_revisions SET translations_json=? WHERE id=?')
    .run('[]', revisionId)).toThrow(/course revision translations are immutable/);
});