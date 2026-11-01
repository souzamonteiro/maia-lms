import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('freezes provider payment ownership and reference while allowing reconciliation updates', () => {
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
      INSERT INTO provider_payments(id,order_id,provider_payment_id,state,raw_ref)
        VALUES('payment-a','order-a','provider-payment-a','pending','{}');
    `);

    expect(() => db.prepare('UPDATE provider_payments SET order_id=? WHERE id=?')
      .run('order-b', 'payment-a')).toThrow(/provider payment identity is immutable/);
    expect(() => db.prepare('UPDATE provider_payments SET provider_payment_id=? WHERE id=?')
      .run('replacement-payment', 'payment-a')).toThrow(/provider payment identity is immutable/);

    db.prepare('UPDATE provider_payments SET state=?,raw_ref=? WHERE id=?')
      .run('approved', '{"amountMinor":1000}', 'payment-a');
    expect(db.prepare('SELECT order_id,provider_payment_id,state,raw_ref FROM provider_payments WHERE id=?')
      .get('payment-a')).toEqual({
        order_id: 'order-a',
        provider_payment_id: 'provider-payment-a',
        state: 'approved',
        raw_ref: '{"amountMinor":1000}',
      });
  } finally {
    db.close();
  }
});
