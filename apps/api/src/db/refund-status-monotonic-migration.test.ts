import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows pending refunds to settle and keeps approved or rejected refunds terminal', () => {
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
        VALUES('approved-refund','order','provider-refund-a',400,'pending'),
              ('rejected-refund','order','provider-refund-b',300,'pending');
    `);

    db.prepare('UPDATE refunds SET status=? WHERE id=?').run('approved', 'approved-refund');
    db.prepare('UPDATE refunds SET status=? WHERE id=?').run('rejected', 'rejected-refund');

    expect(() => db.prepare('UPDATE refunds SET status=? WHERE id=?')
      .run('pending', 'approved-refund')).toThrow(/invalid refund status transition/);
    expect(() => db.prepare('UPDATE refunds SET status=? WHERE id=?')
      .run('approved', 'rejected-refund')).toThrow(/invalid refund status transition/);
    expect(db.prepare('SELECT id,status FROM refunds ORDER BY id').all()).toEqual([
      { id: 'approved-refund', status: 'approved' },
      { id: 'rejected-refund', status: 'rejected' },
    ]);
  } finally {
    db.close();
  }
});
