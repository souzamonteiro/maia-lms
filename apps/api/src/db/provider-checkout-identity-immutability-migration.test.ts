import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows initial checkout assignment and freezes the provider identity afterward', () => {
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
    `);

    expect(() => db.prepare(
      'UPDATE orders SET provider_checkout_id=?,checkout_url=? WHERE id=?',
    ).run('provider-order', 'https://pay.example/checkout', 'order')).not.toThrow();
    expect(() => db.prepare('UPDATE orders SET provider_checkout_id=? WHERE id=?')
      .run('replacement-order', 'order')).toThrow(/provider checkout identity is immutable/);
    expect(() => db.prepare('UPDATE orders SET provider_checkout_id=NULL WHERE id=?')
      .run('order')).toThrow(/provider checkout identity is immutable/);
    expect(() => db.prepare('UPDATE orders SET checkout_url=? WHERE id=?')
      .run('https://attacker.example/checkout', 'order'))
      .toThrow(/provider checkout identity is immutable/);
    expect(() => db.prepare('UPDATE orders SET checkout_url=NULL WHERE id=?')
      .run('order')).toThrow(/provider checkout identity is immutable/);
    expect(db.prepare('SELECT provider_checkout_id,checkout_url FROM orders WHERE id=?')
      .get('order')).toEqual({
        provider_checkout_id: 'provider-order',
        checkout_url: 'https://pay.example/checkout',
      });
  } finally {
    db.close();
  }
});
