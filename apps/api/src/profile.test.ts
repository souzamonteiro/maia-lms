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
const password = 'Profile-test-password-123';

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

async function registerAndLogin(email: string) {
  const registration = await request('/api/v1/auth/register', 'POST', { email, password });
  expect(registration.status).toBe(201);
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
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  }
  db?.close();
});

it('persists a validated display name only for the authenticated account', async () => {
  const firstCookie = await registerAndLogin('profile-one@example.com');
  const secondCookie = await registerAndLogin('profile-two@example.com');

  expect((await request('/api/v1/auth/me', 'GET', undefined, firstCookie)).data.display_name).toBe(
    '',
  );
  expect((await request('/api/v1/auth/profile', 'PUT', { displayName: '  Ada Lovelace  ' })).status)
    .toBe(401);

  const saved = await request(
    '/api/v1/auth/profile',
    'PUT',
    { displayName: '  Ada Lovelace  ' },
    firstCookie,
  );
  expect(saved.status).toBe(200);
  expect(saved.data).toEqual({ displayName: 'Ada Lovelace' });
  const profile = (await request('/api/v1/auth/me', 'GET', undefined, firstCookie)).data;
  expect(profile.display_name).toBe('Ada Lovelace');
  expect(profile.email).toBe('profile-one@example.com');
  expect(profile.role).toBe('learner');
  expect((await request('/api/v1/auth/me', 'GET', undefined, secondCookie)).data.display_name).toBe(
    '',
  );

  for (const displayName of ['', '   ', 'x'.repeat(101)]) {
    expect(
      (
        await request('/api/v1/auth/profile', 'PUT', { displayName }, firstCookie)
      ).status,
    ).toBe(422);
  }
  expect((await request('/api/v1/auth/me', 'GET', undefined, firstCookie)).data.display_name).toBe(
    'Ada Lovelace',
  );
});