import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('validates HTTP and legacy session records without blocking rotation or revocation', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('user','user@example.com','user@example.com','hash');
      INSERT INTO http_sessions(sid,data,expires_at)
        VALUES('sid','{"cookie":{}}',1793650000000);
      INSERT INTO sessions(id,user_id,hash,expires_at)
        VALUES('legacy','user','session-hash','2030-01-01T00:00:00Z');
    `);

    for (const [sid, data, expiresAt] of [
      ['  ', '{"cookie":{}}', 1793650000000],
      ['invalid-data', '{bad', 1793650000000],
      ['array-data', '[]', 1793650000000],
      ['fractional-expiry', '{"cookie":{}}', 1793650000000.5],
      ['negative-expiry', '{"cookie":{}}', -1],
    ]) {
      expect(() => db.prepare('INSERT INTO http_sessions(sid,data,expires_at) VALUES(?,?,?)')
        .run(sid, data, expiresAt)).toThrow(/HTTP session record is invalid/);
    }

    expect(() => db.prepare('UPDATE http_sessions SET sid=? WHERE sid=?')
      .run('replacement-sid', 'sid')).toThrow(/HTTP session identity is immutable/);
    expect(() => db.prepare('UPDATE http_sessions SET data=? WHERE sid=?')
      .run('[]', 'sid')).toThrow(/HTTP session record is invalid/);
    expect(() => db.prepare('UPDATE http_sessions SET expires_at=? WHERE sid=?')
      .run(1793650000000.5, 'sid')).toThrow(/HTTP session record is invalid/);
    expect(() => db.prepare('UPDATE http_sessions SET data=?,expires_at=? WHERE sid=?')
      .run('{"cookie":{"updated":true}}', 1793650001000, 'sid')).not.toThrow();

    for (const [column, value] of [
      ['id', 'replacement'],
      ['user_id', 'other-user'],
      ['hash', 'replacement-hash'],
      ['expires_at', '2031-01-01T00:00:00Z'],
      ['created_at', '2026-11-02T12:00:00Z'],
    ]) {
      expect(() => db.prepare(`UPDATE sessions SET ${column}=? WHERE id='legacy'`).run(value))
        .toThrow(/legacy session identity is immutable/);
    }
    expect(() => db.prepare('UPDATE sessions SET revoked_at=? WHERE id=?')
      .run('2026-11-02T12:00:00Z', 'legacy')).not.toThrow();
    expect(() => db.prepare('UPDATE sessions SET revoked_at=NULL WHERE id=?')
      .run('legacy')).toThrow(/legacy session revocation is irreversible/);
    expect(() => db.prepare('UPDATE sessions SET revoked_at=? WHERE id=?')
      .run('not-a-time', 'legacy')).toThrow(/legacy session revocation is irreversible/);
    expect(() => db.prepare(`
      INSERT INTO sessions(id,user_id,hash,expires_at)
      VALUES('invalid-legacy','user','invalid-hash','not-a-time')
    `).run()).toThrow(/legacy session record is invalid/);
  } finally {
    db.close();
  }
});
