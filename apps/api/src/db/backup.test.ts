import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
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
  db.pragma('journal_mode = WAL');
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
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
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

    const recovery = join(directory, 'recovery');
    execFileSync(process.execPath, [resolve('scripts/restore-bundle.mjs'), '--verify', bundle], {
      stdio: 'pipe',
    });
    renameSync(storage, join(directory, 'offline-storage'));
    execFileSync(process.execPath, [resolve('scripts/restore-bundle.mjs'), bundle, recovery], {
      stdio: 'pipe',
    });
    expect(statSync(recovery).mode & 0o777).toBe(0o700);
    expect(statSync(join(recovery, 'database.sqlite')).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(recovery, 'storage/videos/lesson/master.m3u8'), 'utf8')).toBe('#EXTM3U\n');
    expect(existsSync(join(bundle, 'database.sqlite-wal'))).toBe(false);
    expect(existsSync(join(recovery, 'database.sqlite-wal'))).toBe(false);
    const restored = new Database(join(recovery, 'database.sqlite'), { readonly: true });
    try {
      expect(restored.prepare('SELECT storage_key FROM assets WHERE id=?').get('asset')).toEqual({
        storage_key: 'videos/lesson/master.m3u8',
      });
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      restored.close();
    }
    expect(existsSync(join(bundle, 'manifest.json'))).toBe(true);
    expect(() => execFileSync(
      process.execPath, [resolve('scripts/restore-bundle.mjs'), bundle, recovery], { stdio: 'pipe' },
    )).toThrow(/EEXIST/);
    expect(() => execFileSync(
      process.execPath, [resolve('scripts/restore-bundle.mjs'), bundle, join(bundle, 'nested')], { stdio: 'pipe' },
    )).toThrow(/outside the backup/);
    expect(existsSync(join(bundle, 'nested'))).toBe(false);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([false, true])('invalidates restored authentication atomically (simulated failure: %s)', failure => {
  const directory = mkdtempSync(join(tmpdir(), 'maia-backup-auth-test-'));
  const source = join(directory, 'source.sqlite');
  const storage = join(directory, 'storage');
  const bundle = join(directory, 'bundle');
  const recovery = join(directory, 'recovery');
  mkdirSync(storage);
  const db = new Database(source);
  runMigrations(db);
  try {
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash,locale)
        VALUES('owner','owner@example.com','owner@example.com','unchanged-hash','es');
      INSERT INTO http_sessions(sid,data,expires_at) VALUES('session','{"userId":"owner"}',9999999999999);
      INSERT INTO sessions(id,user_id,hash,expires_at) VALUES('legacy','owner','hash','2099-01-01');
      INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at)
        VALUES('verify','owner','verify-hash','verify','2099-01-01'),
          ('reset','owner','reset-hash','reset','2099-01-01'),
          ('used','owner','used-hash','reset','2000-01-01');
      UPDATE email_tokens SET used_at='2000-01-01' WHERE id='used';
      INSERT INTO account_email_changes(id,user_id,email,email_normalized,token_hash,expires_at)
        VALUES('change','owner','new@example.com','new@example.com','change-hash','2099-01-01');
      INSERT INTO auth_mfa_challenges(token_hash,user_id,expires_at)
        VALUES('challenge','owner','2099-01-01');
      INSERT INTO totp_secrets(user_id,secret,verified_at) VALUES('owner','encrypted-secret','2000-01-01');
      INSERT INTO totp_recovery_codes(user_id,code_hash) VALUES('owner','recovery-hash');
      INSERT INTO outbox(id,event_type,payload,processed_at)
        VALUES('pending-email','email.send','{"to":"private@example.com","token":"invalidated-link"}',NULL),
          ('processed-email','email.send','{"to":"private@example.com"}','2026-01-01'),
          ('pending-other','certificate.generate','{}',NULL);
    `);
    if (failure) db.exec(`CREATE TRIGGER reject_recovery_challenge BEFORE UPDATE ON auth_mfa_challenges
      BEGIN SELECT RAISE(ABORT,'Simulated invalidation failure'); END;`);
    execFileSync(process.execPath, [resolve('scripts/backup-bundle.mjs'), bundle], {
      env: { ...process.env, DATABASE_URL: source, STORAGE_ROOT: storage }, stdio: 'pipe',
    });
    const originalManifest = readFileSync(join(bundle, 'manifest.json'), 'utf8');
    const originalDatabase = readFileSync(join(bundle, 'database.sqlite'));
    const restore = () => execFileSync(process.execPath, [resolve('scripts/restore-bundle.mjs'), bundle, recovery],
      { stdio: 'pipe' });
    if (failure) {
      expect(restore).toThrow(/Simulated invalidation failure/);
      expect(existsSync(join(recovery, 'manifest.json'))).toBe(false);
      expect(existsSync(recovery)).toBe(false);
    } else {
      restore();
      const manifest = JSON.parse(readFileSync(join(recovery, 'manifest.json'), 'utf8'));
      expect(manifest.restoration).toMatchObject({
        authenticationPolicy: 'invalidate',
        invalidated: { accounts: 1, httpSessions: 1, legacySessions: 1, emailTokens: 2, emailChanges: 1, mfaChallenges: 1 },
        unprocessedEmailMessages: 1,
        sourceDatabaseSha256: JSON.parse(originalManifest).database.sha256,
      });
      expect(readFileSync(join(recovery, 'manifest.json'), 'utf8'))
        .not.toContain('private@example.com');
      expect(readFileSync(join(recovery, 'manifest.json'), 'utf8'))
        .not.toContain('invalidated-link');
      expect(manifest.database.sha256).not.toBe(manifest.restoration.sourceDatabaseSha256);
      execFileSync(process.execPath, [resolve('scripts/restore-bundle.mjs'), '--verify', recovery], { stdio: 'pipe' });
    }
    const restored = new Database(
      join(failure ? bundle : recovery, 'database.sqlite'),
      { readonly: true },
    );
    try {
      expect(restored.prepare('SELECT session_version,password_hash,locale,email FROM users').get())
        .toEqual({ session_version: failure ? 0 : 1, password_hash: 'unchanged-hash', locale: 'es', email: 'owner@example.com' });
      expect(restored.prepare('SELECT expires_at FROM http_sessions').get())
        .toEqual({ expires_at: failure ? 9999999999999 : 0 });
      expect(restored.prepare('SELECT revoked_at FROM sessions').get())
        .toEqual({ revoked_at: failure ? null : expect.any(String) });
      expect(restored.prepare('SELECT count(*) AS total FROM email_tokens WHERE used_at IS NULL').get())
        .toEqual({ total: failure ? 2 : 0 });
      expect(restored.prepare("SELECT used_at FROM email_tokens WHERE id='used'").get())
        .toEqual({ used_at: '2000-01-01' });
      expect(restored.prepare('SELECT used_at FROM account_email_changes').get())
        .toEqual({ used_at: failure ? null : expect.any(String) });
      expect(restored.prepare('SELECT consumed_at FROM auth_mfa_challenges').get())
        .toEqual({ consumed_at: failure ? null : expect.any(String) });
      expect(restored.prepare('SELECT secret FROM totp_secrets').get()).toEqual({ secret: 'encrypted-secret' });
      expect(restored.prepare('SELECT used_at FROM totp_recovery_codes').get()).toEqual({ used_at: null });
    } finally {
      restored.close();
    }
    expect(readFileSync(join(bundle, 'manifest.json'), 'utf8')).toBe(originalManifest);
    expect(readFileSync(join(bundle, 'database.sqlite'))).toEqual(originalDatabase);
    expect(db.prepare('SELECT session_version FROM users').get()).toEqual({ session_version: 0 });
    execFileSync(process.execPath, [resolve('scripts/restore-bundle.mjs'), '--verify', bundle], { stdio: 'pipe' });
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  ['changed media', /checksum or size mismatch/],
  ['changed database', /checksum or size mismatch/],
  ['missing media', /inventory/],
  ['extra file', /inventory/],
  ['symlink', /regular file/],
  ['traversal', /manifest storage path/],
  ['duplicate path', /manifest storage path/],
  ['invalid totals', /totals/],
  ['unsupported version', /unsupported backup manifest/],
  ['sidecar', /Unexpected entry/],
  ['missing reference', /database-referenced/],
  ['foreign key violation', /integrity check failed/],
] as const)('rejects a bundle with %s before creating a restore destination', (scenario, error) => {
  const directory = mkdtempSync(join(tmpdir(), 'maia-backup-verify-test-'));
  const source = join(directory, 'live.db');
  const storage = join(directory, 'storage');
  const bundle = join(directory, 'bundle');
  const recovery = join(directory, 'recovery');
  mkdirSync(join(storage, 'objects'), { recursive: true });
  writeFileSync(join(storage, 'objects', 'one'), 'content');
  const db = new Database(source);
  runMigrations(db);
  db.close();
  try {
    execFileSync(process.execPath, [resolve('scripts/backup-bundle.mjs'), bundle], {
      env: { ...process.env, DATABASE_URL: source, STORAGE_ROOT: storage },
      stdio: 'pipe',
    });
    const manifestFile = join(bundle, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const media = join(bundle, 'storage/objects/one');
    const database = join(bundle, 'database.sqlite');
    switch (scenario) {
      case 'changed media': writeFileSync(media, 'changed'); break;
      case 'changed database': writeFileSync(database, 'invalid database'); break;
      case 'missing media': renameSync(media, join(directory, 'moved')); break;
      case 'extra file': writeFileSync(join(bundle, 'storage/extra'), 'extra'); break;
      case 'symlink':
        renameSync(media, join(directory, 'moved'));
        symlinkSync(join(directory, 'moved'), media);
        break;
      case 'traversal': manifest.storage.files[0].path = '../../outside'; break;
      case 'duplicate path': manifest.storage.files.push(manifest.storage.files[0]); break;
      case 'invalid totals': manifest.storage.totalBytes++; break;
      case 'unsupported version': manifest.formatVersion = 2; break;
      case 'sidecar': writeFileSync(`${database}-wal`, 'sidecar'); break;
      case 'missing reference':
      case 'foreign key violation': {
        const changed = new Database(database);
        try {
          changed.pragma('foreign_keys = OFF');
          changed.prepare(
            "INSERT INTO users (id,email,email_normalized,password_hash) VALUES ('test','test@example.com','test@example.com','hash')",
          ).run();
          changed.prepare(
            "INSERT INTO assets (id,owner_id,kind,storage_key) VALUES ('asset',?,'image',?)",
          ).run(
            scenario === 'foreign key violation' ? 'nonexistent' : 'test',
            scenario === 'foreign key violation' ? 'objects/one' : 'objects/missing',
          );
        } finally {
          changed.close();
        }
        manifest.database.size = statSync(database).size;
        manifest.database.sha256 = createHash('sha256').update(readFileSync(database)).digest('hex');
        break;
      }
    }
    writeFileSync(manifestFile, JSON.stringify(manifest));
    for (const args of [['--verify', bundle], [bundle, recovery]]) {
      expect(() => execFileSync(process.execPath, [resolve('scripts/restore-bundle.mjs'), ...args], {
        stdio: 'pipe',
      })).toThrow(error);
    }
    expect(existsSync(recovery)).toBe(false);
  } finally {
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
    expect(existsSync(bundle)).toBe(false);
    mkdirSync(join(storage, 'missing'), { recursive: true });
    writeFileSync(join(storage, 'missing', 'object.png'), 'recovered media');
    expect(() => execFileSync(
      process.execPath, [resolve('scripts/backup-bundle.mjs'), bundle],
      { env: { ...process.env, DATABASE_URL: source, STORAGE_ROOT: storage }, stdio: 'pipe' },
    )).not.toThrow();
    expect(existsSync(join(bundle, 'manifest.json'))).toBe(true);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
