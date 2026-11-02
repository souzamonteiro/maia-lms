import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps verified TOTP credentials stable and replay steps monotonic', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('admin','admin@example.com','admin@example.com','hash');
      INSERT INTO totp_secrets(user_id,secret)
        VALUES('admin','encrypted-secret');
    `);

    expect(() => db.prepare('UPDATE totp_secrets SET secret=? WHERE user_id=?')
      .run('replacement-secret', 'admin')).not.toThrow();
    db.prepare('UPDATE totp_secrets SET verified_at=? WHERE user_id=?')
      .run('2026-11-02T12:00:00Z', 'admin');

    expect(() => db.prepare('UPDATE totp_secrets SET secret=? WHERE user_id=?')
      .run('verified-secret-replacement', 'admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET verified_at=NULL WHERE user_id=?')
      .run('admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET created_at=? WHERE user_id=?')
      .run('2026-11-03T12:00:00Z', 'admin')).toThrow(/TOTP secret lifecycle is invalid/);

    db.prepare('UPDATE totp_secrets SET last_used_step=? WHERE user_id=?').run(1_000_000, 'admin');
    expect(() => db.prepare('UPDATE totp_secrets SET last_used_step=? WHERE user_id=?')
      .run(1_000_000, 'admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET last_used_step=? WHERE user_id=?')
      .run(999_999, 'admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET last_used_step=NULL WHERE user_id=?')
      .run('admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET last_used_step=? WHERE user_id=?')
      .run(1_000_000.5, 'admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET last_used_step=? WHERE user_id=?')
      .run(-1, 'admin')).toThrow(/TOTP secret lifecycle is invalid/);
    expect(() => db.prepare('UPDATE totp_secrets SET user_id=? WHERE user_id=?')
      .run('other-user', 'admin')).toThrow(/TOTP secret identity is immutable/);
  } finally {
    db.close();
  }
});
