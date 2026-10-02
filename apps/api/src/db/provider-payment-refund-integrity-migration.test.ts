import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('deduplicates provider payment/refund references and validates refund amounts', () => {
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
             ('order-c','user','course-b',1000,'BRL','provider-b','key-c');
      INSERT INTO provider_payments(id,order_id,provider_payment_id,state)
            VALUES ('payment-a','order-a','payment-1','approved'),
              ('payment-b','order-b','payment-2','approved');
      INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status)
            VALUES ('refund-a','order-a','refund-1',100,'approved'),
              ('refund-b','order-b','refund-2',50,'approved'),
              ('refund-rejected','order-a','refund-rejected',5000,'rejected');
    `);

    expect(() =>
      db
        .prepare('INSERT INTO provider_payments(id,order_id,provider_payment_id,state) VALUES(?,?,?,?)')
        .run('payment-duplicate', 'order-b', 'payment-1', 'approved'),
    ).toThrow(/duplicate provider payment reference/);
    expect(() =>
      db
        .prepare('INSERT INTO provider_payments(id,order_id,provider_payment_id,state) VALUES(?,?,?,?)')
        .run('payment-other-provider', 'order-c', 'payment-1', 'approved'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE provider_payments SET provider_payment_id=? WHERE id=?').run('payment-1', 'payment-b'),
    ).toThrow(/duplicate provider payment reference/);

    expect(() =>
      db.prepare('INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status) VALUES(?,?,?,?,?)')
        .run('refund-duplicate', 'order-b', 'refund-1', 50, 'approved'),
    ).toThrow(/invalid or duplicate provider refund reference/);
    expect(() =>
      db.prepare('INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status) VALUES(?,?,?,?,?)')
        .run('refund-zero', 'order-b', 'refund-zero', 0, 'pending'),
    ).toThrow(/invalid or duplicate provider refund reference/);
    expect(() =>
      db.prepare('INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status) VALUES(?,?,?,?,?)')
        .run('refund-decimal', 'order-b', 'refund-decimal', 1.5, 'pending'),
    ).toThrow(/invalid or duplicate provider refund reference/);
    expect(() =>
      db.prepare('INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status) VALUES(?,?,?,?,?)')
        .run('refund-other-provider', 'order-c', 'refund-1', 50, 'pending'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE refunds SET provider_ref=? WHERE id=?').run('refund-1', 'refund-other-provider'),
    ).not.toThrow();
    expect(() =>
      db.prepare('UPDATE refunds SET provider_ref=? WHERE id=?').run('refund-1', 'refund-b'),
    ).toThrow(/invalid or duplicate provider refund reference/);
    expect(() =>
      db.prepare('UPDATE refunds SET amount_minor=? WHERE id=?').run(-1, 'refund-a'),
    ).toThrow(/invalid or duplicate provider refund reference/);
    expect(() =>
      db.prepare('INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status) VALUES(?,?,?,?,?)')
        .run('refund-at-limit', 'order-a', 'refund-at-limit', 900, 'pending'),
    ).not.toThrow();
    expect(() =>
      db.prepare('INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status) VALUES(?,?,?,?,?)')
        .run('refund-over-limit', 'order-a', 'refund-over-limit', 1, 'pending'),
    ).toThrow(/refund total exceeds order snapshot/);
    expect(() =>
      db.prepare('UPDATE refunds SET status=? WHERE id=?').run('pending', 'refund-rejected'),
    ).toThrow(/refund total exceeds order snapshot/);
    expect(() =>
      db.prepare('UPDATE refunds SET amount_minor=? WHERE id=?').run(901, 'refund-at-limit'),
    ).toThrow(/refund total exceeds order snapshot/);
  } finally {
    db.close();
  }
});