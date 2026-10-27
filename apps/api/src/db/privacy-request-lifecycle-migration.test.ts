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
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO account_privacy_requests(id,user_id,request_type,status)
      VALUES ('request','user','deletion','OPEN');
    `);

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
  } finally {
    db.close();
  }
});
