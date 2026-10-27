import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps closed privacy requests terminal while allowing normal review transitions', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash'),
             ('other-user','other@example.com','other@example.com','hash');
      INSERT INTO account_privacy_requests(id,user_id,request_type,status)
      VALUES ('request','user','deletion','OPEN');
    `);

    expect(() => db.prepare(`UPDATE account_privacy_requests SET id='other-id'
      WHERE id='request'`).run()).toThrow(/privacy request identity is immutable/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET user_id='other-user'
      WHERE id='request'`).run()).toThrow(/privacy request identity is immutable/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET created_at='2099-01-01'
      WHERE id='request'`).run()).toThrow(/privacy request identity is immutable/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='not-a-date'
      WHERE id='request'`).run()).toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='2000-01-01'
      WHERE id='request'`).run()).toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='2099-01-01'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET updated_at='2098-01-01'
      WHERE id='request'`).run()).toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='IN_REVIEW'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='IN_REVIEW'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='CLOSED'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='CLOSED'
      WHERE id='request'`).run()).not.toThrow();
    expect(() => db.prepare(`UPDATE account_privacy_requests SET status='OPEN'
      WHERE id='request'`).run()).toThrow(/closed privacy requests cannot be reopened/);

    expect(db.prepare('SELECT id,status FROM account_privacy_requests ORDER BY id').all())
      .toEqual([{ id: 'request', status: 'CLOSED' }]);
    expect(() => db.prepare(`INSERT INTO account_privacy_requests
      (id,user_id,request_type,created_at,updated_at)
      VALUES ('bad-date','other-user','deletion','invalid','invalid')`).run())
      .toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`INSERT INTO account_privacy_requests
      (id,user_id,request_type,created_at,updated_at)
      VALUES ('out-of-order','other-user','deletion','2099-01-01','2000-01-01')`).run())
      .toThrow(/privacy request timestamps are invalid/);
    expect(() => db.prepare(`INSERT INTO account_privacy_requests
      (id,user_id,request_type,created_at,updated_at)
      VALUES ('valid-dates','other-user','deletion','2026-01-01T10:00:00Z','2026-01-01T10:00:00Z')`).run())
      .not.toThrow();
  } finally {
    db.close();
  }
});
