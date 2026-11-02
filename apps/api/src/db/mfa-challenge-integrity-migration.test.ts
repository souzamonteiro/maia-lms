import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('preserves MFA challenge identity and one-time recovery lifecycle', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('admin','admin@example.com','admin@example.com','hash');
      INSERT INTO auth_mfa_challenges(token_hash,user_id,expires_at)
        VALUES('challenge-hash','admin','2030-01-01T00:00:00Z');
      INSERT INTO totp_recovery_codes(user_id,code_hash)
        VALUES('admin','recovery-hash');
    `);

    for (const [column, value] of [
      ['token_hash', 'replacement-hash'],
      ['user_id', 'other-user'],
      ['expires_at', '2031-01-01T00:00:00Z'],
      ['created_at', '2026-11-02T12:00:00Z'],
    ]) {
      expect(() => db.prepare(`UPDATE auth_mfa_challenges SET ${column}=? WHERE token_hash='challenge-hash'`)
        .run(value)).toThrow(/MFA challenge identity is immutable/);
    }

    expect(() => db.prepare('UPDATE auth_mfa_challenges SET failed_attempts=1 WHERE token_hash=?')
      .run('challenge-hash')).not.toThrow();
    expect(() => db.prepare('UPDATE auth_mfa_challenges SET failed_attempts=3 WHERE token_hash=?')
      .run('challenge-hash')).toThrow(/MFA challenge lifecycle is invalid/);
    expect(() => db.prepare('UPDATE auth_mfa_challenges SET failed_attempts=0 WHERE token_hash=?')
      .run('challenge-hash')).toThrow(/MFA challenge lifecycle is invalid/);
    expect(() => db.prepare('UPDATE auth_mfa_challenges SET failed_attempts=1.5 WHERE token_hash=?')
      .run('challenge-hash')).toThrow(/MFA challenge lifecycle is invalid/);

    expect(() => db.prepare('UPDATE auth_mfa_challenges SET consumed_at=? WHERE token_hash=?')
      .run('2026-11-02T12:00:00-03:00', 'challenge-hash')).not.toThrow();
    expect(() => db.prepare('UPDATE auth_mfa_challenges SET consumed_at=NULL WHERE token_hash=?')
      .run('challenge-hash')).toThrow(/MFA challenge lifecycle is invalid/);
    expect(() => db.prepare('UPDATE auth_mfa_challenges SET consumed_at=? WHERE token_hash=?')
      .run('2026-11-03T12:00:00Z', 'challenge-hash')).toThrow(/MFA challenge lifecycle is invalid/);
    expect(() => db.prepare('UPDATE auth_mfa_challenges SET failed_attempts=2 WHERE token_hash=?')
      .run('challenge-hash')).toThrow(/MFA challenge lifecycle is invalid/);

    expect(() => db.prepare('UPDATE totp_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=?')
      .run('2026-11-02T12:00:00Z', 'admin', 'recovery-hash')).not.toThrow();
    expect(() => db.prepare('UPDATE totp_recovery_codes SET used_at=NULL WHERE user_id=? AND code_hash=?')
      .run('admin', 'recovery-hash')).toThrow(/TOTP recovery code cannot be restored/);
    expect(() => db.prepare('UPDATE totp_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=?')
      .run('2026-11-03T12:00:00Z', 'admin', 'recovery-hash')).toThrow(/TOTP recovery code use is immutable/);
    expect(() => db.prepare('UPDATE totp_recovery_codes SET created_at=? WHERE user_id=? AND code_hash=?')
      .run('2026-11-02T12:00:00Z', 'admin', 'recovery-hash'))
      .toThrow(/TOTP recovery code creation time is immutable/);

    expect(() => db.prepare(`
      INSERT INTO auth_mfa_challenges(token_hash,user_id,expires_at)
      VALUES('invalid-challenge','admin','not-a-time')
    `).run()).toThrow(/MFA challenge state is invalid/);
    expect(() => db.prepare(`
      INSERT INTO totp_recovery_codes(user_id,code_hash,created_at)
      VALUES('admin','invalid-recovery','not-a-time')
    `).run()).toThrow(/TOTP recovery code timestamp is invalid/);
  } finally {
    db.close();
  }
});
