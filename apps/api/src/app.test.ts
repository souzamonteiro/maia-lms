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
      lessons: [{ title: 'Primeira aula', body: 'Conteúdo reservado', required: true, preview: false }],
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
    it('returns an ordered outline without exposing lessons outside the current access', async () => {
      const admin = await account('outline-admin@example.com', 'admin');
      const learner = await account('outline-learner@example.com');
      const course = draft('lesson-outline');
      course.modules[0].lessons[0].preview = true;
      course.modules[0].lessons.push(
        { title: 'Restricted lesson', body: 'Private', required: true, preview: false },
        { title: 'Second preview', body: 'Public preview', required: true, preview: true },
      );
      const created = await request('/api/v1/admin/courses', 'POST', course, admin.cookie);
      expect(created.status).toBe(201);
      expect(
        (await request(`/api/v1/admin/courses/${created.data.id}/publish`, 'POST', {}, admin.cookie))
          .status,
      ).toBe(200);
      const published = await request('/api/v1/courses/lesson-outline');
      const [first, restricted, secondPreview] = published.data.modules[0].lessons;

      const preview = await request(`/api/v1/lessons/${first.id}`);
      expect(preview.data.navigation.modules[0].lessons.map((item: { id: string }) => item.id)).toEqual(
        [first.id, secondPreview.id],
      );
      expect(JSON.stringify(preview.data.navigation)).not.toContain('Restricted lesson');
      expect(preview.data.navigation.previous_lesson_id).toBeNull();
      expect(preview.data.navigation.next_lesson_id).toBe(secondPreview.id);

      await request(`/api/v1/courses/${published.data.id}/enroll`, 'POST', {}, learner.cookie);
      const enrolled = await request(`/api/v1/lessons/${first.id}`, 'GET', undefined, learner.cookie);
      expect(enrolled.data.navigation.modules[0].lessons.map((item: { id: string }) => item.id)).toEqual(
        [first.id, restricted.id, secondPreview.id],
      );
      const middle = await request(`/api/v1/lessons/${restricted.id}`, 'GET', undefined, learner.cookie);
      expect(middle.data.navigation.previous_lesson_id).toBe(first.id);
      expect(middle.data.navigation.next_lesson_id).toBe(secondPreview.id);
          const initialContinue = await request('/api/v1/me/enrollments', 'GET', undefined, learner.cookie);
          expect(initialContinue.data[0].continue_lesson_id).toBe(first.id);
          await request(
            `/api/v1/lessons/${secondPreview.id}/progress`,
            'PUT',
            { positionSeconds: 42 },
            learner.cookie,
          );
          const resumedContinue = await request('/api/v1/me/enrollments', 'GET', undefined, learner.cookie);
          expect(resumedContinue.data[0].continue_lesson_id).toBe(secondPreview.id);
          await request(
            `/api/v1/lessons/${first.id}/progress`,
            'PUT',
            { complete: true },
            learner.cookie,
          );
          const nextContinue = await request('/api/v1/me/enrollments', 'GET', undefined, learner.cookie);
          expect(nextContinue.data[0].continue_lesson_id).toBe(secondPreview.id);
          await request(
            `/api/v1/lessons/${secondPreview.id}/progress`,
            'PUT',
            { complete: true },
            learner.cookie,
          );
          const remainingContinue = await request('/api/v1/me/enrollments', 'GET', undefined, learner.cookie);
          expect(remainingContinue.data[0].continue_lesson_id).toBe(restricted.id);
          expect(remainingContinue.data[0].continue_lesson_title).toBe('Restricted lesson');
    });
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
      (
        await request(
          `/api/v1/admin/courses/${c.id}`,
          'PUT',
          {
            ...changed,
            expectedRevisionId: (
              await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie)
            ).data.current_revision_id,
          },
          admin.cookie,
        )
      ).status,
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
  it('invalidates older password-reset links when a newer recovery is requested', async () => {
    await account('reset-reissue@example.com');
    const issueResetToken = async () => {
      await request('/api/v1/auth/forgot-password', 'POST', { email: 'reset-reissue@example.com' });
      const { payload } = db
        .prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1')
        .get() as { payload: string };
      return JSON.parse(payload).text.match(/token=([a-f0-9]{64})/)[1] as string;
    };
    const oldToken = await issueResetToken();
    const currentToken = await issueResetToken();

    const oldTokenResult = await request('/api/v1/auth/reset-password', 'POST', {
      token: oldToken,
      password: 'First-reset-password-123',
    });
    expect(oldTokenResult.status).toBe(400);
    expect(oldTokenResult.data.code).toBe('AUTH_TOKEN_INVALID');
    expect(
      (
        await request('/api/v1/auth/reset-password', 'POST', {
          token: currentToken,
          password: 'Current-reset-password-123',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('/api/v1/auth/reset-password', 'POST', {
          token: currentToken,
          password: 'Replayed-reset-password-123',
        })
      ).status,
    ).toBe(400);
  });
  it('changes passwords only with the current password and revokes prior sessions and reset tokens', async () => {
        const user = await account('password-change@example.com');
        expect(
          (
            await request('/api/v1/auth/change-password', 'POST', {
              currentPassword: password,
              newPassword: 'Changed-password-123',
            })
          ).status,
        ).toBe(401);
        const secondSession = await request('/api/v1/auth/login', 'POST', {
          email: 'password-change@example.com',
          password,
        });
        await request('/api/v1/auth/forgot-password', 'POST', {
          email: 'password-change@example.com',
        });
        const resetMail = db
          .prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1')
          .get() as { payload: string };
        const resetToken = JSON.parse(resetMail.payload).text.match(/token=([a-f0-9]+)/)[1];

        const rejected = await request(
          '/api/v1/auth/change-password',
          'POST',
          { currentPassword: 'Wrong-current-password-123', newPassword: 'Changed-password-123' },
          user.cookie,
        );
        expect(rejected.status).toBe(401);
        expect((await request('/api/v1/auth/me', 'GET', undefined, user.cookie)).status).toBe(200);
        const unchanged = await request(
          '/api/v1/auth/change-password',
          'POST',
          { currentPassword: password, newPassword: password },
          user.cookie,
        );
        expect(unchanged.status).toBe(422);
        expect(unchanged.data.code).toBe('AUTH_PASSWORD_UNCHANGED');

        const changed = await request(
          '/api/v1/auth/change-password',
          'POST',
          { currentPassword: password, newPassword: 'Changed-password-123' },
          user.cookie,
        );
        expect(changed.status).toBe(204);
        expect((await request('/api/v1/auth/me', 'GET', undefined, user.cookie)).status).toBe(401);
        expect(
          (await request('/api/v1/auth/me', 'GET', undefined, secondSession.cookie)).status,
        ).toBe(401);
        expect(
          (await request('/api/v1/auth/reset-password', 'POST', {
            token: resetToken,
            password: 'Reset-password-456',
          })).status,
        ).toBe(400);
        expect((await request('/api/v1/auth/login', 'POST', {
          email: 'password-change@example.com',
          password: 'Changed-password-123',
        })).status).toBe(200);
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
    const editor = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie))
      .data;
    const change = {
      ...draft('future-address', 'OPEN_FREE'),
      title: 'Draft only',
      expectedRevisionId: editor.current_revision_id,
    };
    const saved = await request(`/api/v1/admin/courses/${c.id}`, 'PUT', change, admin.cookie);
    expect(saved.status).toBe(200);
    const publicView = (await request('/api/v1/courses/stable-course')).data;
    expect(publicView.title).toBe('Curso de teste');
    expect(publicView.access_mode).toBe('ENROLLED_FREE');
    expect((await request('/api/v1/courses/future-address')).status).toBe(404);
    const newDraft = (
      await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie)
    ).data;
    expect(newDraft.slug).toBe('future-address');
    const newLesson = newDraft.modules[0].lessons[0].id;
    expect((await request(`/api/v1/lessons/${newLesson}`)).status).toBe(403);
    const enrolled = await request(`/api/v1/courses/${c.id}/enroll`, 'POST', {}, learner.cookie);
    expect(enrolled.data.revision_id).toBe(editor.current_revision_id);
    expect(
      (await request(`/api/v1/admin/courses/${c.id}`, 'PUT', change, admin.cookie)).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/v1/admin/courses/${c.id}/publish`,
          'POST',
          { expectedRevisionId: editor.current_revision_id },
          admin.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/v1/admin/courses/${c.id}/publish`,
          'POST',
          { expectedRevisionId: saved.data.current_revision_id },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await request('/api/v1/courses/future-address')).data.title).toBe('Draft only');
    expect((await request(`/api/v1/lessons/${newLesson}`)).status).toBe(200);
    expect(
      (await request(`/api/v1/courses/${c.id}`, 'GET', undefined, learner.cookie)).data.title,
    ).toBe('Curso de teste');
  });
  it('restricts draft reading, writes and previews to the owner or administrator', async () => {
    const admin = await account('admin@example.com', 'admin');
    const author = await account('author@example.com', 'author');
    const learner = await account('learner@example.com');
    const c = await publish(admin.cookie, 'owned-course');
    expect(
      (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, author.cookie)).status,
    ).toBe(403);
    expect(
      (
        await request(
          '/api/v1/admin/content/preview',
          'POST',
          { body: '**bold**', contentFormat: 'markdown' },
          learner.cookie,
        )
      ).status,
    ).toBe(403);
    const preview = await request(
      '/api/v1/admin/content/preview',
      'POST',
      { body: '**bold**', contentFormat: 'markdown' },
      author.cookie,
    );
    expect(preview.data.html).toContain('<strong>bold</strong>');
    const revision = (
      await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie)
    ).data.current_revision_id;
    expect(
      (
        await request(
          `/api/v1/admin/courses/${c.id}`,
          'PUT',
          { ...draft('owned-course'), expectedRevisionId: revision },
          author.cookie,
        )
      ).status,
    ).toBe(403);
  });
  it('serves the same safe Markdown in the preview and a published lesson', async () => {
    const admin = await account('admin@example.com', 'admin');
    const data = draft('markdown-course', 'OPEN_FREE');
    const lesson = {
      ...data.modules[0].lessons[0],
      body: '# Title\n\n**Text**\n\n<script>alert(1)</script>',
      contentFormat: 'markdown',
      renderPolicyVersion: 999,
    };
    const created = await request(
      '/api/v1/admin/courses',
      'POST',
      { ...data, modules: [{ title: 'Module', lessons: [lesson] }] },
      admin.cookie,
    );
    await request(`/api/v1/admin/courses/${created.data.id}/publish`, 'POST', {}, admin.cookie);
    const detail = (await request('/api/v1/courses/markdown-course')).data;
    const result = await request(`/api/v1/lessons/${detail.modules[0].lessons[0].id}`);
    const preview = await request('/api/v1/admin/content/preview', 'POST', lesson, admin.cookie);
    expect(result.data.body_html).toBe(preview.data.html);
    expect(preview.data.renderPolicyVersion).toBe(1);
    expect(result.data.render_policy_version).toBe(1);
    expect(detail.modules[0].lessons[0].render_policy_version).toBe(1);
    expect(result.data.body_html).toContain('<h1>Title</h1>');
    expect(result.data.body_html).not.toContain('<script>');
  });
  it('curates home independently from the catalog, with scheduling and optimistic concurrency', async () => {
    const admin = await account('admin@example.com', 'admin');
    const author = await account('author@example.com', 'author');
    const first = await publish(admin.cookie, 'first-home');
    const second = await publish(admin.cookie, 'second-home');
    const third = await publish(admin.cookie, 'third-home');
    const date = offset => new Date(Date.now() + offset).toISOString();
    const placement = (
      courseId: string,
      priority: number,
      slot = 'featured',
      startsAt = date(-3600000),
      endsAt: string | null = null,
    ) => ({ courseId, priority, slot, startsAt, endsAt });
    const data = {
      expectedVersion: 0,
      items: [
        placement(first.id, 5),
        placement(second.id, 1),
        placement(third.id, 0, 'hero', date(3600000)),
        placement(third.id, 0, 'recommended', date(-7200000), date(-3600000)),
      ],
    };
    expect((await request('/api/v1/admin/home', 'PUT', data, author.cookie)).status).toBe(403);
    expect((await request('/api/v1/admin/home', 'PUT', data, admin.cookie)).status).toBe(200);
    const selected = (await request('/api/v1/home')).data;
    expect(selected.featured.map(c => c.id)).toEqual([second.id, first.id]);
    expect(selected.hero).toEqual([]);
    expect(selected.recommended).toEqual([]);
    expect((await request('/api/v1/admin/home', 'PUT', data, admin.cookie)).status).toBe(409);
    const draftOnly = (
      await request('/api/v1/admin/courses', 'POST', draft('draft-only'), admin.cookie)
    ).data;
    expect(
      (
        await request(
          '/api/v1/admin/home',
          'PUT',
          { expectedVersion: 1, items: [placement(draftOnly.id, 0)] },
          admin.cookie,
        )
      ).status,
    ).toBe(422);
    expect((await request('/api/v1/admin/home', 'GET', undefined, admin.cookie)).data.version).toBe(
      1,
    );
    await request(`/api/v1/admin/courses/${second.id}/archive`, 'POST', {}, admin.cookie);
    expect((await request('/api/v1/home')).data.featured.map(c => c.id)).toEqual([first.id]);
    await request('/api/v1/admin/home', 'PUT', { expectedVersion: 1, items: [] }, admin.cookie);
    expect((await request('/api/v1/home')).data.featured).toEqual([]);
    expect((await request('/api/v1/courses')).data.map(c => c.id)).toContain(first.id);
  });
});

it('does not spend the credential-attempt limit on normal page session lookups', async () => {
  const learner = await account('reader@example.com');
  for (let i = 0; i < 22; i++)
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(200);
  expect(
    (await request('/api/v1/auth/login', 'POST', { email: 'reader@example.com', password })).status,
  ).toBe(200);
});
it('still limits repeated credential attempts', async () => {
  for (let i = 0; i < 20; i++)
    expect((await request('/api/v1/auth/login', 'POST', {})).status).toBe(422);
  expect((await request('/api/v1/auth/login', 'POST', {})).status).toBe(429);
});

describe('author draft audience preview', () => {
  it('enforces ownership, hides visitor content, and never publishes or enrolls', async () => {
    const admin = await account('preview-admin@example.com', 'admin');
    const author = await account('preview-author@example.com', 'author');
    const learner = await account('preview-learner@example.com');
    const data = draft('preview-draft', 'ENROLLED_FREE');
    data.modules[0].lessons = [
      {
        ...data.modules[0].lessons[0],
        title: 'Private',
        body: '**Private body**',
        contentFormat: 'markdown',
        preview: false,
      },
      {
        ...data.modules[0].lessons[0],
        title: 'Sample',
        body: '**Sample body**',
        contentFormat: 'markdown',
        preview: true,
      },
    ];
    const created = await request('/api/v1/admin/courses', 'POST', data, author.cookie);
    const url = `/api/v1/admin/courses/${created.data.id}/preview?revisionId=${created.data.current_revision_id}`;
    expect((await request(`${url}&audience=learner`)).status).toBe(401);
    expect(
      (await request(`${url}&audience=learner`, 'GET', undefined, learner.cookie)).status,
    ).toBe(403);
    const other = await account('other-author@example.com', 'author');
    expect((await request(`${url}&audience=learner`, 'GET', undefined, other.cookie)).status).toBe(
      403,
    );
    const visitor = await request(`${url}&audience=visitor`, 'GET', undefined, author.cookie);
    expect(visitor.status).toBe(200);
    expect(visitor.data.modules[0].lessons[0]).toMatchObject({ title: 'Private', locked: true });
    expect(visitor.data.modules[0].lessons[0]).not.toHaveProperty('body_html');
    expect(visitor.data.modules[0].lessons[1].body_html).toContain('<strong>Sample body</strong>');
    const enrolled = await request(`${url}&audience=learner`, 'GET', undefined, admin.cookie);
    expect(enrolled.data.modules[0].lessons[0].body_html).toContain(
      '<strong>Private body</strong>',
    );
    expect(enrolled.response.headers.get('cache-control')).toContain('no-store');
    expect((await request(`${url}&audience=invalid`, 'GET', undefined, author.cookie)).status).toBe(
      422,
    );
    expect((await request(`/api/v1/courses/${created.data.id}`)).status).toBe(404);
    const mine = await request('/api/v1/me/enrollments', 'GET', undefined, author.cookie);
    expect(mine.data).toEqual([]);
    await request(
      `/api/v1/admin/courses/${created.data.id}`,
      'PUT',
      { ...data, expectedRevisionId: created.data.current_revision_id },
      author.cookie,
    );
    expect((await request(`${url}&audience=learner`, 'GET', undefined, author.cookie)).status).toBe(
      409,
    );
  });
});

describe('incremental draft saves', () => {
  it('applies editing units atomically, preserves publication, and rejects stale or unauthorized writes', async () => {
    const admin = await account('incremental-admin@example.com', 'admin');
    const other = await account('incremental-other@example.com', 'author');
    const c = await publish(admin.cookie, 'incremental-course', 'OPEN_FREE');
    const old = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie))
      .data;
    const oldLesson = old.modules[0].lessons[0];
    const value = {
      title: 'Updated lesson',
      body: '**Updated**',
      contentFormat: 'markdown',
      required: true,
      preview: false,
    };
    const change = {
      expectedRevisionId: old.current_revision_id,
      changes: [{ unit: 'lesson', module: 0, lesson: 0, value }],
    };
    expect(
      (await request(`/api/v1/admin/courses/${c.id}`, 'PATCH', change, other.cookie)).status,
    ).toBe(403);
    const invalid = await request(
      `/api/v1/admin/courses/${c.id}`,
      'PATCH',
      { ...change, changes: [...change.changes, { unit: 'module', module: 99, title: 'Invalid' }] },
      admin.cookie,
    );
    expect(invalid.status).toBe(422);
    expect(
      (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie)).data
        .current_revision_id,
    ).toBe(old.current_revision_id);
    const saved = await request(`/api/v1/admin/courses/${c.id}`, 'PATCH', change, admin.cookie);
    expect(saved.status).toBe(200);
    expect(saved.data.published_revision_id).toBe(old.current_revision_id);
    expect((await request(`/api/v1/lessons/${oldLesson.id}`)).data.body).toBe(oldLesson.body);
    const updated = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie))
      .data;
    expect(updated.modules[0].lessons[0].body).toBe('**Updated**');
    expect(updated.modules[0].title).toBe(old.modules[0].title);
    expect(
      (await request(`/api/v1/admin/courses/${c.id}`, 'PATCH', change, admin.cookie)).status,
    ).toBe(409);
    const metadata = {
      slug: old.slug,
      title: 'Updated course',
      summary: old.summary,
      accessMode: old.access_mode,
      locale: old.locale,
      attachments: [],
    };
    const next = await request(
      `/api/v1/admin/courses/${c.id}`,
      'PATCH',
      {
        expectedRevisionId: saved.data.current_revision_id,
        changes: [
          { unit: 'course', value: metadata },
          { unit: 'module', module: 0, title: 'Updated module' },
        ],
      },
      admin.cookie,
    );
    expect(next.status).toBe(200);
    const final = (await request(`/api/v1/admin/courses/${c.id}`, 'GET', undefined, admin.cookie))
      .data;
    expect(final.title).toBe('Updated course');
    expect(final.modules[0].title).toBe('Updated module');
    expect(final.modules[0].lessons[0].body).toBe('**Updated**');
  });
});

describe('publication checklist', () => {
  it('lists every incomplete lesson and blocks publication until corrected', async () => {
    const admin = await account('check-admin@example.com', 'admin');
    const other = await account('check-other@example.com', 'author');
    const data = draft('check-course', 'OPEN_FREE');
    data.modules[0].lessons = [
      { ...data.modules[0].lessons[0], title: 'First empty', body: '' },
      { ...data.modules[0].lessons[0], title: 'Second empty', body: '  ' },
    ];
    const created = await request('/api/v1/admin/courses', 'POST', data, admin.cookie);
    const url = `/api/v1/admin/courses/${created.data.id}`;
    const query = `/publication-check?revisionId=${created.data.current_revision_id}`;
    expect((await request(url + query, 'GET', undefined, other.cookie)).status).toBe(403);
    const check = await request(url + query, 'GET', undefined, admin.cookie);
    expect(check.data.ready).toBe(false);
    expect(check.data.issues.map(issue => issue.lessonTitle)).toEqual([
      'First empty',
      'Second empty',
    ]);
    const blocked = await request(url + '/publish', 'POST', {}, admin.cookie);
    expect(blocked.status).toBe(422);
    expect(blocked.data.issues).toEqual(check.data.issues);
    expect((await request(url, 'GET', undefined, admin.cookie)).data.status).toBe('DRAFT');
    data.modules[0].lessons.forEach(lesson => {
      lesson.body = 'Ready to publish';
    });
    const saved = await request(
      url,
      'PUT',
      { ...data, expectedRevisionId: created.data.current_revision_id },
      admin.cookie,
    );
    expect((await request(url + query, 'GET', undefined, admin.cookie)).status).toBe(409);
    expect(
      (
        await request(
          url + `/publication-check?revisionId=${saved.data.current_revision_id}`,
          'GET',
          undefined,
          admin.cookie,
        )
      ).data.ready,
    ).toBe(true);
    expect(
      (
        await request(
          url + '/publish',
          'POST',
          { expectedRevisionId: saved.data.current_revision_id },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
  });
});

describe('course presentation', () => {
  it('preserves published presentation and keeps metadata through lesson-only saves', async () => {
    const admin = await account('presentation@example.com', 'admin');
    const data = {
      ...draft('presentation', 'OPEN_FREE'),
      instructorName: 'Original instructor',
      instructorBio: 'Original biography',
      accessTerms: 'Free enrollment',
      certificateTerms: 'No certificate',
      learningOutcomes: 'Build a project',
      prerequisites: 'Basic programming',
      level: 'beginner',
      durationMinutes: 90,
    };
    const created = (await request('/api/v1/admin/courses', 'POST', data, admin.cookie)).data;
    const url = `/api/v1/admin/courses/${created.id}`;
    await request(url + '/publish', 'POST', {}, admin.cookie);
    const edited = (
      await request(
        url,
        'PUT',
        {
          ...data,
          instructorName: 'Draft instructor',
          accessTerms: 'Draft access terms',
          learningOutcomes: 'Draft objectives',
          durationMinutes: 120,
          expectedRevisionId: created.current_revision_id,
        },
        admin.cookie,
      )
    ).data;
    const publicView = (await request(`/api/v1/courses/${created.id}`)).data;
    expect(publicView.learning_outcomes).toBe('Build a project');
    expect(publicView.instructor_name).toBe('Original instructor');
    expect(publicView.access_terms).toBe('Free enrollment');
    expect(publicView.duration_minutes).toBe(90);
    const saved = await request(
      url,
      'PATCH',
      {
        expectedRevisionId: edited.current_revision_id,
        changes: [
          {
            unit: 'lesson',
            module: 0,
            lesson: 0,
            value: { title: 'Edited lesson', body: 'Updated text' },
          },
        ],
      },
      admin.cookie,
    );
    expect(saved.status).toBe(200);
    const detail = (await request(url, 'GET', undefined, admin.cookie)).data;
    expect(detail).toMatchObject({
      instructor_name: 'Draft instructor',
      instructor_bio: 'Original biography',
      access_terms: 'Draft access terms',
      certificate_terms: 'No certificate',
      learning_outcomes: 'Draft objectives',
      prerequisites: 'Basic programming',
      level: 'beginner',
      duration_minutes: 120,
    });
    for (const invalid of [
      { instructorName: 'x'.repeat(201) },
      { instructorBio: 'x'.repeat(5001) },
      { accessTerms: 'x'.repeat(5001) },
      { certificateTerms: 'x'.repeat(5001) },
      { durationMinutes: -1 },
      { durationMinutes: 0.5 },
      { level: 'expert' },
      { prerequisites: 'x'.repeat(5001) },
    ]) {
      expect(
        (
          await request(
            url,
            'PUT',
            { ...data, ...invalid, expectedRevisionId: detail.current_revision_id },
            admin.cookie,
          )
        ).status,
      ).toBe(422);
    }
  });
});

describe('paginated course catalog', () => {
  it('reaches courses beyond 100, combines published filters, and validates queries', async () => {
    db.exec(
      "INSERT INTO users(id,email,email_normalized,password_hash) VALUES('catalog-user','catalog@tests.test','catalog@tests.test','hash')",
    );
    for (let i = 0; i < 106; i++) {
      const id = `catalog-${String(i).padStart(3, '0')}`;
      db.prepare("INSERT INTO courses(id,slug,author_id,status) VALUES(?,?,'catalog-user',?)").run(
        id,
        id,
        i === 105 ? 'DRAFT' : 'PUBLISHED',
      );
      db.prepare(
        'INSERT INTO course_revisions(id,course_id,title,summary,locale,level,access_mode) VALUES(?,?,?,?,?,?,?)',
      ).run(
        id + '-r',
        id,
        `Catalog ${String(i).padStart(3, '0')}${i === 0 ? ' 100%' : ''}`,
        'Catalog test summary',
        i % 2 ? 'es' : 'en',
        i % 2 ? 'advanced' : 'beginner',
        i % 2 ? 'ENROLLED_FREE' : 'OPEN_FREE',
      );
      db.prepare('UPDATE courses SET current_revision_id=?,published_revision_id=? WHERE id=?').run(
        id + '-r',
        id + '-r',
        id,
      );
    }
    const first = (await request('/api/v1/courses?format=page&pageSize=100&sort=title')).data;
    const second = (await request('/api/v1/courses?format=page&pageSize=100&page=2&sort=title'))
      .data;
    expect(first.total).toBe(105);
    expect(first.items).toHaveLength(100);
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map(c => c.id)).size).toBe(105);
    expect((await request('/api/v1/courses')).data).toHaveLength(100);
    const filtered = (
      await request('/api/v1/courses?format=page&locale=en&level=beginner&accessMode=OPEN_FREE')
    ).data;
    expect(filtered.total).toBe(53);
    expect((await request('/api/v1/courses?format=page&q=%25')).data.total).toBe(1);
    expect((await request('/api/v1/courses?format=page&locale=en&level=advanced')).data.total).toBe(
      0,
    );
    expect((await request('/api/v1/courses?format=page&page=999')).data.items).toEqual([]);
    for (const query of [
      'page=0',
      'page=1.5',
      'pageSize=101',
      'sort=unsafe',
      'locale=xx',
      'level=expert',
      'q=a&q=b',
    ])
      expect((await request('/api/v1/courses?' + query)).status).toBe(422);
    db.prepare(
      "UPDATE course_revisions SET title='Unpublished secret',locale='pt-BR' WHERE id='catalog-105-r'",
    ).run();
    expect((await request('/api/v1/courses?format=page&q=Unpublished')).data.total).toBe(0);
    db.prepare(
      "INSERT INTO course_revisions(id,course_id,title,summary,locale) VALUES('catalog-new-draft','catalog-000','Unpublished draft secret','Draft summary','pt-BR')",
    ).run();
    db.prepare(
      "UPDATE courses SET current_revision_id='catalog-new-draft' WHERE id='catalog-000'",
    ).run();
    expect((await request('/api/v1/courses?format=page&q=Unpublished')).data.total).toBe(0);
    expect((await request('/api/v1/courses?format=page&locale=pt-BR')).data.total).toBe(0);
  });
});

describe('course categories', () => {
  it('restricts taxonomy management, validates input and protects concurrent changes', async () => {
    const admin = await account('taxonomy@example.com', 'admin');
    const author = await account('taxonomy-author@example.com', 'author');
    const payload = { slug: 'programming', name: 'Programming', description: 'Build software' };
    expect((await request('/api/v1/admin/categories', 'POST', payload)).status).toBe(401);
    expect((await request('/api/v1/admin/categories', 'POST', payload, author.cookie)).status).toBe(
      403,
    );
    expect(
      (await request('/api/v1/admin/categories', 'POST', { ...payload, name: '   ' }, admin.cookie))
        .status,
    ).toBe(422);
    const created = await request('/api/v1/admin/categories', 'POST', payload, admin.cookie);
    expect(created.status).toBe(201);
    const path = `/api/v1/admin/categories/${created.data.id}`;
    expect(
      (await request('/api/v1/admin/categories', 'POST', payload, admin.cookie)).data.code,
    ).toBe('CATEGORY_SLUG_EXISTS');
    expect(
      (
        await request(
          path,
          'PUT',
          { ...payload, name: '<b>Code</b>', expectedVersion: 1 },
          admin.cookie,
        )
      ).data.version,
    ).toBe(2);
    expect(
      (await request(path, 'PUT', { ...payload, expectedVersion: 1 }, admin.cookie)).data.code,
    ).toBe('CATEGORY_CONFLICT');
    expect((await request('/api/v1/categories')).data).toEqual([
      expect.objectContaining({ name: '<b>Code</b>' }),
    ]);
    expect((await request(path, 'DELETE', { expectedVersion: 1 }, admin.cookie)).status).toBe(409);
    expect((await request(path, 'DELETE', { expectedVersion: 2 }, author.cookie)).status).toBe(403);
    expect((await request(path, 'DELETE', { expectedVersion: 2 }, admin.cookie)).status).toBe(204);
    expect((await request('/api/v1/categories')).data).toEqual([]);
  });

  it('versions assignments, combines catalog filters and retains historical references', async () => {
    const admin = await account('categories-admin@example.com', 'admin');
    const category = await request(
      '/api/v1/admin/categories',
      'POST',
      { slug: 'science', name: 'Science' },
      admin.cookie,
    );
    const categoryId = category.data.id;
    const body = {
      ...draft('science-course', 'OPEN_FREE'),
      locale: 'en',
      level: 'beginner',
      categoryIds: [categoryId],
    };
    const unknown = { ...body, categoryIds: ['00000000-0000-4000-8000-000000000000'] };
    expect((await request('/api/v1/admin/courses', 'POST', unknown, admin.cookie)).data.code).toBe(
      'CATEGORY_NOT_FOUND',
    );
    expect(
      (
        await request(
          '/api/v1/admin/courses',
          'POST',
          { ...body, categoryIds: [categoryId, categoryId] },
          admin.cookie,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await request(
          '/api/v1/admin/courses',
          'POST',
          { ...body, categoryIds: Array(11).fill(categoryId) },
          admin.cookie,
        )
      ).status,
    ).toBe(422);
    const created = await request('/api/v1/admin/courses', 'POST', body, admin.cookie);
    expect(created.status).toBe(201);
    const path = `/api/v1/admin/courses/${created.data.id}`;
    const filtered =
      '/api/v1/courses?format=page&category=science&locale=en&level=beginner&accessMode=OPEN_FREE';
    expect((await request(filtered)).data.total).toBe(0);
    expect((await request(`${path}/publish`, 'POST', {}, admin.cookie)).status).toBe(200);
    expect((await request(filtered)).data.total).toBe(1);
    const publicDetail = (await request('/api/v1/courses/science-course')).data;
    expect(publicDetail.categories[0].id).toBe(categoryId);
    const patched = await request(
      path,
      'PATCH',
      {
        expectedRevisionId: created.data.current_revision_id,
        changes: [{ unit: 'module', module: 0, title: 'Changed module' }],
      },
      admin.cookie,
    );
    expect(patched.status).toBe(200);
    expect((await request(path, 'GET', undefined, admin.cookie)).data.categories[0].id).toBe(
      categoryId,
    );
    const edited = await request(
      path,
      'PUT',
      { ...body, categoryIds: [], expectedRevisionId: patched.data.current_revision_id },
      admin.cookie,
    );
    expect(edited.status).toBe(200);
    expect((await request(filtered)).data.total).toBe(1);
    expect(
      (
        await request(
          `${path}/preview?revisionId=${edited.data.current_revision_id}&audience=visitor`,
          'GET',
          undefined,
          admin.cookie,
        )
      ).data.categories,
    ).toEqual([]);
    expect((await request(`${path}/publish`, 'POST', {}, admin.cookie)).status).toBe(200);
    expect((await request(filtered)).data.total).toBe(0);
    expect((await request('/api/v1/courses/science-course')).data.categories).toEqual([]);
    expect(
      (
        await request(
          `/api/v1/admin/categories/${categoryId}`,
          'DELETE',
          { expectedVersion: 1 },
          admin.cookie,
        )
      ).data.code,
    ).toBe('CATEGORY_IN_USE');
    expect(
      (await request('/api/v1/courses?category=unknown-category&format=page')).data.total,
    ).toBe(0);
    expect((await request('/api/v1/courses?category=invalid%20slug')).status).toBe(422);
  });
});

describe('localized account workflows', () => {
  it.each([
    ['en', 'Verify your Maia account', 'Reset your Maia password'],
    ['pt-BR', 'Verifique sua conta Maia', 'Recupere sua senha Maia'],
    ['es', 'Verifica tu cuenta Maia', 'Restablece tu contraseña de Maia'],
    ['fr', 'Verify your Maia account', 'Reset your Maia password'],
  ])(
    'queues verification and recovery using saved locale %s',
    async (locale, verifySubject, resetSubject) => {
      const email = 'localized@example.com';
      const registered = await request('/api/v1/auth/register', 'POST', {
        email,
        password,
        locale,
      });
      expect(registered.status).toBe(201);
      const emails = () =>
        (
          db
            .prepare("SELECT payload FROM outbox WHERE event_type='email.send' ORDER BY rowid")
            .all() as { payload: string }[]
        ).map(row => JSON.parse(row.payload));
      expect(emails()[0].subject).toBe(verifySubject);
      expect(emails()[0].text).toMatch(
        /\/auth\/verify-email\?lang=(en|pt-BR|es)&token=[a-f0-9]{64}$/,
      );
      const token = emails()[0].text.match(/token=([a-f0-9]+)/)[1];
      expect((await request(`/api/v1/auth/verify-email?token=${token}`)).status).toBe(200);
      expect((await request(`/api/v1/auth/verify-email?token=${token}`)).data.code).toBe(
        'AUTH_TOKEN_USED',
      );
      expect(
        (await request('/api/v1/auth/forgot-password', 'POST', { email, locale: 'es' })).status,
      ).toBe(204);
      expect(emails()[1].subject).toBe(resetSubject);
      expect(emails()[1].text).toMatch(/\/auth\/reset-password\?token=[a-f0-9]{64}$/);
      expect(
        (await request('/api/v1/auth/forgot-password', 'POST', { email: 'unknown@example.com' }))
          .status,
      ).toBe(204);
      expect(emails()).toHaveLength(2);
      expect(
        (await request('/api/v1/auth/register', 'POST', { email, password, locale })).data.code,
      ).toBe('AUTH_EMAIL_EXISTS');
    },
  );
  it('returns stable codes for invalid credentials, expired tokens and invalid passwords', async () => {
    const user = await account('errors@example.com');
    expect(
      (
        await request('/api/v1/auth/login', 'POST', {
          email: 'errors@example.com',
          password: 'wrong-password',
        })
      ).data.code,
    ).toBe('AUTH_INVALID_CREDENTIALS');
    await request('/api/v1/auth/forgot-password', 'POST', { email: 'errors@example.com' });
    const { payload } = db
      .prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1')
      .get() as { payload: string };
    const token = JSON.parse(payload).text.match(/token=([a-f0-9]+)/)[1];
    expect(
      (await request('/api/v1/auth/reset-password', 'POST', { token, password: 'short' })).data
        .code,
    ).toBe('AUTH_PASSWORD_LENGTH');
    db.prepare("UPDATE email_tokens SET expires_at='2000-01-01T00:00:00Z'").run();
    expect(
      (await request('/api/v1/auth/reset-password', 'POST', { token, password })).data.code,
    ).toBe('AUTH_TOKEN_EXPIRED');
    expect((await request('/api/v1/auth/verify-email?token=invalid')).data.code).toBe(
      'AUTH_TOKEN_INVALID',
    );
    expect((await request('/api/v1/auth/me', 'GET', undefined, user.cookie)).status).toBe(200);
  });
});

describe('verification email resend', () => {
      it('returns the same response for unknown and verified accounts, and resends in the saved locale', async () => {
        const unknown = await request('/api/v1/auth/resend-verification', 'POST', {
          email: 'missing-resend@example.com',
        });
        expect(unknown.status).toBe(204);

        const registered = await request('/api/v1/auth/register', 'POST', {
          email: 'resend@example.com',
          password,
          locale: 'pt-BR',
        });
        expect(registered.status).toBe(201);
        const before = db
          .prepare("SELECT token_hash FROM email_tokens WHERE user_id = ? AND kind = 'verify'")
          .get(registered.data.id) as { token_hash: string };
        const originalPayload = db
          .prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1')
          .get() as { payload: string };
        const originalToken = JSON.parse(originalPayload.payload).text.match(/token=([a-f0-9]+)/)[1];

        const resent = await request('/api/v1/auth/resend-verification', 'POST', {
          email: 'RESEND@example.com',
          locale: 'es',
        });
        expect(resent.status).toBe(204);
        const rows = db
          .prepare('SELECT token_hash, used_at FROM email_tokens WHERE user_id = ? AND kind = \'verify\' ORDER BY rowid')
          .all(registered.data.id) as { token_hash: string; used_at: string | null }[];
        expect(rows).toHaveLength(2);
        expect(rows[0].used_at).toBeTruthy();
        expect(rows[1].token_hash).not.toBe(before.token_hash);
        expect(
          (await request('/api/v1/auth/verify-email', 'POST', { token: originalToken })).data.code,
        ).toBe('AUTH_TOKEN_USED');
        const payload = db
          .prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1')
          .get() as { payload: string };
        const mail = JSON.parse(payload.payload) as { subject: string; text: string };
        expect(mail.subject).toBe('Verifique sua conta Maia');
        expect(mail.text).toContain('/auth/verify-email?lang=pt-BR&token=');

        db.prepare("UPDATE users SET verified_at = datetime('now') WHERE id = ?").run(registered.data.id);
        const verified = await request('/api/v1/auth/resend-verification', 'POST', {
          email: 'resend@example.com',
        });
        expect(verified.status).toBe(204);
        expect(
          db.prepare("SELECT count(*) AS n FROM email_tokens WHERE user_id = ? AND kind = 'verify'").get(registered.data.id),
        ).toEqual({ n: 2 });
      });
  });

describe('account interface language preference', () => {
    it('persists supported locales, rejects unsupported values, and requires authentication', async () => {
      const user = await account('locale-preference@example.com');
      expect((await request('/api/v1/auth/locale', 'PUT', { locale: 'es' })).status).toBe(401);
      for (const locale of ['en', 'pt-BR', 'es']) {
        const updated = await request(
          '/api/v1/auth/locale',
          'PUT',
          { locale },
          user.cookie,
        );
        expect(updated.status).toBe(200);
        expect(updated.data).toEqual({ locale });
        expect((await request('/api/v1/auth/me', 'GET', undefined, user.cookie)).data.locale).toBe(
          locale,
        );
      }

      const invalid = await request('/api/v1/auth/locale', 'PUT', { locale: 'fr' }, user.cookie);
      expect(invalid.status).toBe(422);
      expect((await request('/api/v1/auth/me', 'GET', undefined, user.cookie)).data.locale).toBe(
        'es',
      );
    });

    it('uses the saved account locale for recovery emails, not the request locale', async () => {
      const user = await account('locale-recovery@example.com');
      const cases = [
        ['en', 'pt-BR', 'Reset your Maia password', 'Reset your password:'],
        ['pt-BR', 'es', 'Recupere sua senha Maia', 'Redefina sua senha:'],
        ['es', 'en', 'Restablece tu contraseña de Maia', 'Restablece tu contraseña:'],
      ];
      for (const [accountLocale, requestLocale, subject, prompt] of cases) {
        expect(
          (await request(
            '/api/v1/auth/locale',
            'PUT',
            { locale: accountLocale },
            user.cookie,
          )).status,
        ).toBe(200);
        expect(
          (
            await request(
              '/api/v1/auth/forgot-password',
              'POST',
              { email: 'locale-recovery@example.com', locale: requestLocale },
            )
          ).status,
        ).toBe(204);
        const { payload } = db
          .prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1')
          .get() as { payload: string };
        const email = JSON.parse(payload) as { subject: string; text: string };
        expect(email.subject).toBe(subject);
        expect(email.text).toContain(prompt);
      }
    });
  });

  describe('email verification confirmation', () => {
  it('serves a non-consuming page and atomically consumes verification tokens through POST', async () => {
    const registered = await request('/api/v1/auth/register', 'POST', {
      email: 'confirm@example.com',
      password,
      locale: 'es',
    });
    const row = db.prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1').get() as {
      payload: string;
    };
    const url = new URL(JSON.parse(row.payload).text.match(/https?:\/\/\S+/)[0]);
    expect(url.pathname).toBe('/auth/verify-email');
    expect(url.searchParams.get('lang')).toBe('es');
    expect((await request(url.pathname + url.search)).status).toBe(200);
    expect(db.prepare('SELECT verified_at FROM users WHERE id=?').get(registered.data.id)).toEqual({
      verified_at: null,
    });
    const token = url.searchParams.get('token');
    const results = await Promise.all([
      request('/api/v1/auth/verify-email', 'POST', { token }),
      request('/api/v1/auth/verify-email', 'POST', { token }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    expect(results.find(result => result.status === 200)?.data.code).toBe('EMAIL_VERIFIED');
    expect(results.find(result => result.status === 400)?.data.code).toBe('AUTH_TOKEN_USED');
    expect(
      (
        db.prepare('SELECT verified_at FROM users WHERE id=?').get(registered.data.id) as {
          verified_at: string;
        }
      ).verified_at,
    ).toBeTruthy();
    expect((await request(`/api/v1/auth/verify-email?token=${token}`)).data.code).toBe(
      'AUTH_TOKEN_USED',
    );
  });
  it('rejects expired, malformed and password-reset tokens without verifying the account', async () => {
    const registered = await request('/api/v1/auth/register', 'POST', {
      email: 'expired@example.com',
      password,
    });
    const verification = JSON.parse(
      (
        db.prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1').get() as {
          payload: string;
        }
      ).payload,
    ).text.match(/token=([a-f0-9]+)/)[1];
    db.prepare("UPDATE email_tokens SET expires_at='2000-01-01T00:00:00Z'").run();
    expect(
      (await request('/api/v1/auth/verify-email', 'POST', { token: verification })).data.code,
    ).toBe('AUTH_TOKEN_EXPIRED');
    await request('/api/v1/auth/forgot-password', 'POST', { email: 'expired@example.com' });
    const reset = JSON.parse(
      (
        db.prepare('SELECT payload FROM outbox ORDER BY rowid DESC LIMIT 1').get() as {
          payload: string;
        }
      ).payload,
    ).text.match(/token=([a-f0-9]+)/)[1];
    for (const token of [reset, 'invalid', null, [verification]])
      expect((await request('/api/v1/auth/verify-email', 'POST', { token })).data.code).toBe(
        'AUTH_TOKEN_INVALID',
      );
    expect(db.prepare('SELECT verified_at FROM users WHERE id=?').get(registered.data.id)).toEqual({
      verified_at: null,
    });
    expect(
      db.prepare('SELECT count(*) AS n FROM email_tokens WHERE used_at IS NOT NULL').get(),
    ).toEqual({ n: 0 });
  });
});

describe('administrator account status management', () => {
  it('lists/searches users and suspends/reactivates with session invalidation and audit', async () => {
    const admin = await account('users-admin@example.com', 'admin');
    const learner = await account('managed-learner@example.com');
    const author = await account('managed-author@example.com', 'author');

    expect((await request('/api/v1/admin/users', 'GET', undefined, learner.cookie)).status).toBe(403);
    const search = await request('/api/v1/admin/users?q=managed-&limit=1&offset=0', 'GET', undefined, admin.cookie);
    expect(search.status).toBe(200);
    expect(search.data.total).toBe(2);
    expect(search.data.items).toHaveLength(1);
    expect(search.data.items[0]).not.toHaveProperty('password_hash');
    expect(search.data.items[0]).not.toHaveProperty('email_normalized');
    const authors = await request('/api/v1/admin/users?role=author&status=active', 'GET', undefined, admin.cookie);
    expect(authors.data.items.map((user: { id: string }) => user.id)).toContain(author.id);

    const beforeVersion = (
      db.prepare('SELECT session_version FROM users WHERE id=?').get(learner.id) as {
        session_version: number;
      }
    ).session_version;
    const suspended = await request(
      `/api/v1/admin/users/${learner.id}/status`,
      'PATCH',
      { status: 'suspended' },
      admin.cookie,
    );
    expect(suspended.status).toBe(200);
    expect(suspended.data.status).toBe('suspended');
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(401);
    expect(
      (db.prepare('SELECT session_version FROM users WHERE id=?').get(learner.id) as { session_version: number })
        .session_version,
    ).toBe(beforeVersion + 1);

    const repeated = await request(
      `/api/v1/admin/users/${learner.id}/status`,
      'PATCH',
      { status: 'suspended' },
      admin.cookie,
    );
    expect(repeated.status).toBe(200);
    expect(
      db.prepare("SELECT count(*) AS n FROM audit_events WHERE subject_id=? AND action='user.suspend'").get(learner.id),
    ).toEqual({ n: 1 });

    const reactivated = await request(
      `/api/v1/admin/users/${learner.id}/status`,
      'PATCH',
      { status: 'active' },
      admin.cookie,
    );
    expect(reactivated.status).toBe(200);
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(401);
    expect(
      (
        await request('/api/v1/auth/login', 'POST', {
          email: 'managed-learner@example.com',
          password,
        })
      ).status,
    ).toBe(200);
    expect(
      db.prepare("SELECT count(*) AS n FROM audit_events WHERE subject_id=? AND action='user.reactivate'").get(learner.id),
    ).toEqual({ n: 1 });
  });

  it('prevents self-suspension and keeps an active administrator available', async () => {
    const admin = await account('sole-admin@example.com', 'admin');
    const selfSuspend = await request(
      `/api/v1/admin/users/${admin.id}/status`,
      'PATCH',
      { status: 'suspended' },
      admin.cookie,
    );
    expect(selfSuspend.status).toBe(409);
    expect(selfSuspend.data.code).toBe('ADMIN_SELF_SUSPEND');

    const otherAdmin = await account('other-admin@example.com', 'admin');
    const suspendedOther = await request(
      `/api/v1/admin/users/${otherAdmin.id}/status`,
      'PATCH',
      { status: 'suspended' },
      admin.cookie,
    );
    expect(suspendedOther.status).toBe(200);
    expect((await request('/api/v1/admin/users', 'GET', undefined, admin.cookie)).status).toBe(200);
    const selfSuspendAsLastAdmin = await request(
      `/api/v1/admin/users/${admin.id}/status`,
      'PATCH',
      { status: 'suspended' },
      admin.cookie,
    );
    expect(selfSuspendAsLastAdmin.status).toBe(409);
    expect(selfSuspendAsLastAdmin.data.code).toBe('ADMIN_SELF_SUSPEND');
  });

  it('delegates learner/author/admin roles, revokes sessions, and protects the last administrator', async () => {
    const admin = await account('role-admin@example.com', 'admin');
    const learner = await account('role-target@example.com');
    const secondAdmin = await account('role-second-admin@example.com', 'admin');

    const delegated = await request(
      `/api/v1/admin/users/${learner.id}/role`,
      'PATCH',
      { role: 'author' },
      admin.cookie,
    );
    expect(delegated.status).toBe(200);
    expect(delegated.data.role).toBe('author');
    expect((await request('/api/v1/auth/me', 'GET', undefined, learner.cookie)).status).toBe(401);
    const authorLogin = await request('/api/v1/auth/login', 'POST', {
      email: 'role-target@example.com',
      password,
    });
    expect(authorLogin.status).toBe(200);
    expect(authorLogin.data.role).toBe('author');
    expect(
      db.prepare("SELECT count(*) AS n FROM audit_events WHERE subject_id=? AND action='user.role_change'").get(learner.id),
    ).toEqual({ n: 1 });

    expect(
      (await request(`/api/v1/admin/users/${secondAdmin.id}/role`, 'PATCH', { role: 'author' }, admin.cookie))
        .status,
    ).toBe(200);
    expect(
      (
        await request(`/api/v1/admin/users/${admin.id}/role`, 'PATCH', { role: 'author' }, admin.cookie)
      ).data.code,
    ).toBe('ADMIN_SELF_ROLE_CHANGE');
    expect(
      (
        await request(`/api/v1/admin/users/${learner.id}/role`, 'PATCH', { role: 'worker' }, admin.cookie)
      ).status,
    ).toBe(422);
    expect(
      (
        await request(`/api/v1/admin/users/${learner.id}/role`, 'PATCH', { role: 'learner' }, admin.cookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/v1/admin/users/${learner.id}/role`, 'PATCH', { role: 'learner' }, admin.cookie)
      ).status,
    ).toBe(200);
    expect(
      db.prepare("SELECT count(*) AS n FROM audit_events WHERE subject_id=? AND action='user.role_change'").get(learner.id),
    ).toEqual({ n: 2 });
    expect(
      (db.prepare('SELECT role FROM users WHERE id=?').get(secondAdmin.id) as { role: string }).role,
    ).toBe('author');
  });
});
