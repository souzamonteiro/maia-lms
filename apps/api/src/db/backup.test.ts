import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

it('creates a verifiable database-and-media bundle that can be restored in isolation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'maia-backup-bundle-test-'));
  const source = join(directory, 'live.db');
  const storage = join(directory, 'storage');
  const bundle = join(directory, 'bundle');
  mkdirSync(join(storage, 'videos', 'lesson'), { recursive: true });
  writeFileSync(join(storage, 'videos', 'lesson', 'master.m3u8'), '#EXTM3U\n');
  const db = new Database(source);
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  try {
    db.prepare(
      "INSERT INTO users (id,email,email_normalized,password_hash) VALUES ('test','test@example.com','test@example.com','hash')",
    ).run();
    db.prepare(
      "INSERT INTO assets (id,owner_id,kind,storage_key) VALUES ('asset','test','image','videos/lesson/master.m3u8')",
    ).run();
    execFileSync(process.execPath, [resolve('scripts/backup-bundle.mjs'), bundle], {
      env: { ...process.env, DATABASE_URL: source, STORAGE_ROOT: storage },
      stdio: 'pipe',
    });

    const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'));
    expect(statSync(join(bundle, 'database.sqlite')).mode & 0o777).toBe(0o600);
    expect(manifest.database.integrityCheck).toBe('ok');
    expect(manifest.database.foreignKeyViolations).toBe(0);
    expect(manifest.storage.files).toEqual([
      expect.objectContaining({
        path: 'videos/lesson/master.m3u8',
        size: Buffer.byteLength('#EXTM3U\n'),
        sha256: createHash('sha256').update('#EXTM3U\n').digest('hex'),
      }),
    ]);
    expect(statSync(join(bundle, 'storage/videos/lesson/master.m3u8')).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(bundle, 'storage/videos/lesson/master.m3u8'), 'utf8')).toBe('#EXTM3U\n');

    const restored = new Database(join(bundle, 'database.sqlite'), { readonly: true });
    try {
      expect(restored.prepare('SELECT storage_key FROM assets WHERE id=?').get('asset')).toEqual({
        storage_key: 'videos/lesson/master.m3u8',
      });
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      restored.close();
    }
    expect(existsSync(join(bundle, 'manifest.json'))).toBe(true);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('refuses to mark a bundle complete when a referenced media object is missing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'maia-backup-bundle-missing-test-'));
  const source = join(directory, 'live.db');
  const storage = join(directory, 'storage');
  const bundle = join(directory, 'bundle');
  mkdirSync(storage);
  const db = new Database(source);
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  try {
    db.prepare(
      "INSERT INTO users (id,email,email_normalized,password_hash) VALUES ('test','test@example.com','test@example.com','hash')",
    ).run();
    db.prepare(
      "INSERT INTO assets (id,owner_id,kind,storage_key) VALUES ('asset','test','image','missing/object.png')",
    ).run();
    expect(() =>
      execFileSync(process.execPath, [resolve('scripts/backup-bundle.mjs'), bundle], {
        env: { ...process.env, DATABASE_URL: source, STORAGE_ROOT: storage },
        stdio: 'pipe',
      }),
    ).toThrow();
    expect(existsSync(join(bundle, 'manifest.json'))).toBe(false);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
