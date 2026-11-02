import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps refund IDs and creation timestamps immutable while allowing provider reconciliation', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course','course','buyer');
      INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key)
        VALUES('order','buyer','course',1000,'BRL','provider-a','key');
      INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status)
        VALUES('refund','order','pending:refund',400,'pending');
    `);

    expect(() => db.prepare('UPDATE refunds SET id=? WHERE id=?')
      .run('replacement-refund', 'refund')).toThrow(/refund identity is immutable/);
    expect(() => db.prepare('UPDATE refunds SET created_at=? WHERE id=?')
      .run('2026-11-02 12:00:00', 'refund')).toThrow(/refund identity is immutable/);

    expect(() => db.prepare('UPDATE refunds SET provider_ref=?,status=? WHERE id=?')
      .run('provider-refund', 'approved', 'refund')).not.toThrow();
    expect(db.prepare('SELECT id,provider_ref,status FROM refunds WHERE id=?')
      .get('refund')).toEqual({
      id: 'refund',
      provider_ref: 'provider-refund',
      status: 'approved',
    });
  } finally {
    db.close();
  }
});
