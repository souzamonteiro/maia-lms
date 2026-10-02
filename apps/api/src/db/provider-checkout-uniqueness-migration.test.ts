import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('deduplicates non-null checkout references within each provider', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user','user@example.com','user@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','user'),('course-b','course-b','user');
      INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key)
      VALUES ('order-a','user','course-a',1000,'BRL','provider-a','key-a'),
             ('order-b','user','course-b',1000,'BRL','provider-a','key-b'),
             ('order-c','user','course-a',1000,'BRL','provider-b','key-c'),
             ('order-d','user','course-b',1000,'BRL','provider-a','key-d');
    `);
    db.prepare('UPDATE orders SET provider_checkout_id=? WHERE id=?').run('checkout-1', 'order-a');
    db.prepare('UPDATE orders SET provider_checkout_id=? WHERE id=?').run('checkout-1', 'order-c');

    expect(() =>
      db.prepare('INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key,provider_checkout_id) VALUES(?,?,?,?,?,?,?,?)')
        .run('order-insert-duplicate', 'user', 'course-a', 1000, 'BRL', 'provider-a', 'key-insert-duplicate', 'checkout-1'),
    ).toThrow(/duplicate provider checkout reference/);
    expect(() =>
      db.prepare('INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key) VALUES(?,?,?,?,?,?,?)')
        .run('order-insert-null', 'user', 'course-a', 1000, 'BRL', 'provider-a', 'key-insert-null'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET provider_checkout_id=? WHERE id=?').run('checkout-1', 'order-b'),
    ).toThrow(/duplicate provider checkout reference/);
    expect(() =>
      db.prepare('UPDATE orders SET provider_checkout_id=? WHERE id=?').run('checkout-2', 'order-b'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET provider_checkout_id=? WHERE id=?').run('checkout-2', 'order-d'),
    ).toThrow(/duplicate provider checkout reference/);
    expect(() =>
      db.prepare('UPDATE orders SET provider_checkout_id=NULL WHERE id=?').run('order-b'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET provider_checkout_id=NULL WHERE id=?').run('order-d'),
    ).not.toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM orders WHERE provider_checkout_id IS NULL').get()).toEqual({
      n: 3,
    });
  } finally {
    db.close();
  }
});