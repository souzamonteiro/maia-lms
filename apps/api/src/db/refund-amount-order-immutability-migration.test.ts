import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('freezes refund order and amount while allowing provider reconciliation', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
        VALUES('course-a','course-a','buyer'),('course-b','course-b','buyer');
      INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key)
        VALUES('order-a','buyer','course-a',1000,'BRL','provider-a','key-a'),
              ('order-b','buyer','course-b',1000,'BRL','provider-a','key-b');
      INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status)
        VALUES('refund-a','order-a','pending:refund-a',500,'pending');
    `);

    expect(() => db.prepare('UPDATE refunds SET order_id=? WHERE id=?')
      .run('order-b', 'refund-a')).toThrow(/refund order and amount are immutable/);
    expect(() => db.prepare('UPDATE refunds SET amount_minor=? WHERE id=?')
      .run(600, 'refund-a')).toThrow(/refund order and amount are immutable/);

    db.prepare('UPDATE refunds SET provider_ref=?,status=? WHERE id=?')
      .run('provider-refund-a', 'approved', 'refund-a');
    expect(db.prepare('SELECT order_id,provider_ref,amount_minor,status FROM refunds WHERE id=?')
      .get('refund-a')).toEqual({
        order_id: 'order-a',
        provider_ref: 'provider-refund-a',
        amount_minor: 500,
        status: 'approved',
      });
  } finally {
    db.close();
  }
});
