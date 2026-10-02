import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('keeps order-backed entitlements attached to the order owner and course', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES ('user-a','a@example.com','a@example.com','hash'),
             ('user-b','b@example.com','b@example.com','hash');
      INSERT INTO courses(id,slug,author_id)
      VALUES ('course-a','course-a','user-a'),('course-b','course-b','user-a');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES ('revision-a','course-a','Course A','Summary A'),
             ('revision-b','course-b','Course B','Summary B');
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
      VALUES ('enrollment-a','user-a','course-a','revision-a'),
             ('enrollment-b','user-a','course-b','revision-b'),
             ('enrollment-other-user','user-b','course-a','revision-a');
      INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key)
      VALUES ('order-a','user-a','course-a',1000,'BRL','mercado_pago','key-a'),
             ('order-b','user-a','course-b',1000,'BRL','mercado_pago','key-b'),
             ('order-other-user','user-b','course-a',1000,'BRL','mercado_pago','key-c');
      INSERT INTO entitlements(id,enrollment_id,source_type,source_id,starts_at)
      VALUES ('entitlement-order-a','enrollment-a','order','order-a',datetime('now'));
    `);

    const addOrderEntitlement = db.prepare(
      'INSERT INTO entitlements(id,enrollment_id,source_type,source_id,starts_at) VALUES(?,?,?,?,datetime(?))',
    );
    expect(() =>
      addOrderEntitlement.run('wrong-course', 'enrollment-a', 'order', 'order-b', 'now'),
    ).toThrow(/order entitlement reference mismatch/);
    expect(() =>
      addOrderEntitlement.run('wrong-user', 'enrollment-other-user', 'order', 'order-a', 'now'),
    ).toThrow(/order entitlement reference mismatch/);
    expect(() =>
      addOrderEntitlement.run('missing-order', 'enrollment-a', 'order', 'missing', 'now'),
    ).toThrow(/order entitlement reference mismatch/);
    expect(() =>
      db.prepare('UPDATE entitlements SET source_id=? WHERE id=?').run('order-b', 'entitlement-order-a'),
    ).toThrow(/order entitlement reference mismatch/);
    expect(() =>
      db.prepare('UPDATE orders SET course_id=? WHERE id=?').run('course-b', 'order-a'),
    ).toThrow(/order snapshot is immutable/);
    expect(() => db.prepare('UPDATE orders SET id=? WHERE id=?').run('order-renamed', 'order-a')).toThrow(
      /order entitlement reference mismatch/,
    );
    expect(() => db.prepare('DELETE FROM orders WHERE id=?').run('order-a')).toThrow(
      /order entitlement reference mismatch/,
    );
    expect(() =>
      db.prepare('UPDATE orders SET price_snapshot=? WHERE id=?').run(2000, 'order-b'),
    ).toThrow(/order snapshot is immutable/);
    expect(() =>
      db.prepare('UPDATE orders SET currency=? WHERE id=?').run('USD', 'order-b'),
    ).toThrow(/order snapshot is immutable/);
    expect(() =>
      db.prepare('UPDATE orders SET idempotency_key=? WHERE id=?').run('changed-key', 'order-b'),
    ).toThrow(/order snapshot is immutable/);
    expect(() =>
      db.prepare('UPDATE orders SET provider=? WHERE id=?').run('other-provider', 'order-b'),
    ).toThrow(/order snapshot is immutable/);
    expect(() =>
      db.prepare('INSERT INTO orders(id,user_id,course_id,price_snapshot,currency,provider,idempotency_key) VALUES(?,?,?,?,?,?,?)')
        .run('zero-price', 'user-a', 'course-a', 0, 'BRL', 'mercado_pago', 'key-zero'),
    ).toThrow(/invalid order price snapshot/);
    expect(() =>
      db.prepare('UPDATE orders SET state=?,provider_checkout_id=? WHERE id=?')
        .run('CHECKOUT_PENDING', 'checkout-1', 'order-b'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('PAID', 'order-b'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('PARTIALLY_REFUNDED', 'order-b'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('REFUNDED', 'order-b'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('PAID', 'order-b'),
    ).toThrow(/invalid order state transition/);
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('CHECKOUT_PENDING', 'order-b'),
    ).toThrow(/invalid order state transition/);
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('CANCELED', 'order-a'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE orders SET state=? WHERE id=?').run('PAID', 'order-a'),
    ).not.toThrow();
    expect(
      db.prepare('SELECT source_id FROM entitlements WHERE id=?').get('entitlement-order-a'),
    ).toEqual({ source_id: 'order-a' });
  } finally {
    db.close();
  }
});