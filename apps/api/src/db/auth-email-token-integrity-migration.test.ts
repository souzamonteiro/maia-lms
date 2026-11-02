import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('freezes email token identities and keeps token consumption irreversible', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('user','user@example.com','user@example.com','hash');
      INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at)
        VALUES('verify','user','verify-hash','verify','2030-01-01T00:00:00Z');
      INSERT INTO account_email_changes(
        id,user_id,email,email_normalized,token_hash,expires_at
      ) VALUES(
        'email-change','user','next@example.com','next@example.com',
        'change-hash','2030-01-01T00:00:00Z'
      );
    `);

    for (const [column, value] of [
      ['id', 'replacement'],
      ['user_id', 'other-user'],
      ['token_hash', 'replacement-hash'],
      ['kind', 'reset'],
      ['expires_at', '2031-01-01T00:00:00Z'],
      ['created_at', '2026-11-02T12:00:00Z'],
    ]) {
      expect(() => db.prepare(`UPDATE email_tokens SET ${column}=? WHERE id='verify'`).run(value))
        .toThrow(/email token identity is immutable/);
    }

    for (const [column, value] of [
      ['id', 'replacement'],
      ['created_at', '2026-11-02T12:00:00Z'],
    ]) {
      expect(() => db.prepare(`UPDATE account_email_changes SET ${column}=? WHERE id='email-change'`)
        .run(value)).toThrow(/email change request identity is immutable/);
    }

    for (const [column, value] of [
      ['user_id', 'other-user'],
      ['email', 'replacement@example.com'],
      ['email_normalized', 'replacement@example.com'],
      ['token_hash', 'replacement-hash'],
      ['expires_at', '2031-01-01T00:00:00Z'],
    ]) {
      expect(() => db.prepare(`UPDATE account_email_changes SET ${column}=? WHERE id='email-change'`)
        .run(value)).toThrow(/email change request is immutable/);
    }

    expect(() => db.prepare('UPDATE email_tokens SET used_at=? WHERE id=?')
      .run('2026-11-02T12:00:00-03:00', 'verify')).not.toThrow();
    expect(() => db.prepare('UPDATE email_tokens SET used_at=NULL WHERE id=?')
      .run('verify')).toThrow(/email token use is irreversible/);
    expect(() => db.prepare('UPDATE email_tokens SET used_at=? WHERE id=?')
      .run('2026-11-01T12:00:00Z', 'verify')).toThrow(/email token use is irreversible/);
    expect(() => db.prepare('UPDATE email_tokens SET used_at=? WHERE id=?')
      .run('not-a-time', 'verify')).toThrow(/email token use is irreversible/);

    expect(() => db.prepare('UPDATE account_email_changes SET used_at=? WHERE id=?')
      .run('2026-11-02T12:00:00Z', 'email-change')).not.toThrow();
    expect(() => db.prepare('UPDATE account_email_changes SET used_at=NULL WHERE id=?')
      .run('email-change')).toThrow(/email change token cannot be restored/);
    expect(() => db.prepare('UPDATE account_email_changes SET used_at=? WHERE id=?')
      .run('not-a-time', 'email-change')).toThrow(/email change request timestamp is invalid|email change token use timestamp is invalid/);

    expect(() => db.prepare(`
      INSERT INTO email_tokens(id,user_id,token_hash,kind,expires_at)
      VALUES('invalid-email-token','user','invalid-token-hash','verify','not-a-time')
    `).run()).toThrow(/email token timestamp is invalid/);
    expect(() => db.prepare(`
      INSERT INTO account_email_changes(
        id,user_id,email,email_normalized,token_hash,expires_at
      ) VALUES('invalid-email-change','user','bad@example.com','bad@example.com','bad-hash','not-a-time')
    `).run()).toThrow(/email change request timestamp is invalid/);
  } finally {
    db.close();
  }
});
