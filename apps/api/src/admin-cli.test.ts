import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './db/migrate.js';

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts/admin.mjs');
let directory = '';

function setupDatabase() {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-admin-cli-'));
  const databasePath = path.join(directory, 'test.db');
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return { db, databasePath };
}

function runAdmin(databasePath: string, email: string, password: string, reset = false) {
  return spawnSync(
    process.execPath,
    [scriptPath, email, ...(reset ? ['--reset'] : [])],
    {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databasePath, ADMIN_PASSWORD: password },
    },
  );
}

afterEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = '';
});

describe('administrator bootstrap CLI', () => {
  it('creates a verified administrator and audits the bootstrap', async () => {
    const { db, databasePath } = setupDatabase();
    db.close();

    const result = runAdmin(databasePath, 'first-admin@example.com', 'First-admin-password-123');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Administrator created.');
    const reopened = new Database(databasePath);
    const user = reopened
      .prepare('SELECT id,role,verified_at,session_version FROM users WHERE email_normalized=?')
      .get('first-admin@example.com') as
      | { id: string; role: string; verified_at: string | null; session_version: number }
      | undefined;
    expect(user).toMatchObject({ role: 'admin', session_version: 0 });
    expect(user?.verified_at).toBeTruthy();
    expect(
      reopened
        .prepare('SELECT action,subject_type,subject_id FROM audit_events WHERE subject_id=?')
        .get(user?.id),
    ).toEqual({ action: 'admin.bootstrap', subject_type: 'user', subject_id: user?.id });
    reopened.close();
  });

  it('refuses implicit overwrite, then reset rotates the password and invalidates sessions', async () => {
    const { db, databasePath } = setupDatabase();
    const oldHash = await argon2.hash('Old-admin-password-123', { type: argon2.argon2id });
    db.prepare(
      "INSERT INTO users (id,email,email_normalized,password_hash,role) VALUES ('existing-admin','reset-admin@example.com','reset-admin@example.com',?,'learner')",
    ).run(oldHash);
    db.close();

    const refused = runAdmin(databasePath, 'reset-admin@example.com', 'New-admin-password-123');
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('Pass --reset');
    const reset = runAdmin(
      databasePath,
      'reset-admin@example.com',
      'New-admin-password-123',
      true,
    );
    expect(reset.status).toBe(0);
    expect(reset.stdout).toContain('Administrator password reset.');

    const reopened = new Database(databasePath);
    const user = reopened
      .prepare('SELECT password_hash,role,session_version FROM users WHERE id=?')
      .get('existing-admin') as { password_hash: string; role: string; session_version: number };
    expect(user.role).toBe('admin');
    expect(user.session_version).toBe(1);
    expect(await argon2.verify(user.password_hash, 'New-admin-password-123')).toBe(true);
    expect(await argon2.verify(user.password_hash, 'Old-admin-password-123')).toBe(false);
    expect(
      reopened
        .prepare('SELECT action,subject_type,subject_id FROM audit_events WHERE subject_id=?')
        .get('existing-admin'),
    ).toEqual({
      action: 'admin.account_reset',
      subject_type: 'user',
      subject_id: 'existing-admin',
    });
    reopened.close();
  });
});