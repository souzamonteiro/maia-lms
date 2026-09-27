import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runMigrations } from './migrate.js';
it('backs up a live WAL database and restores it without sidecar files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'maia-backup-test-'));
  const source = join(directory, 'live.db');
  const target = join(directory, 'backup.db');
  const db = new Database(source);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  try {
    db.prepare(
      "INSERT INTO users (id,email,email_normalized,password_hash) VALUES ('test','test@example.com','test@example.com','hash')",
    ).run();
    execFileSync(process.execPath, [resolve('scripts/backup.mjs'), target], {
      env: { ...process.env, DATABASE_URL: source },
      stdio: 'pipe',
    });
    expect(statSync(target).mode & 0o777).toBe(0o600);
    const restored = new Database(target);
    try {
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(restored.pragma('foreign_key_check')).toEqual([]);
      expect(restored.prepare('SELECT email FROM users').get()).toEqual({
        email: 'test@example.com',
      });
      expect(() => runMigrations(restored)).not.toThrow();
    } finally {
      restored.close();
    }
    expect(() =>
      execFileSync(process.execPath, [resolve('scripts/backup.mjs'), target], {
        env: { ...process.env, DATABASE_URL: source },
        stdio: 'pipe',
      }),
    ).toThrow();
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
