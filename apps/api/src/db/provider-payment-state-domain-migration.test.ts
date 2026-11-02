import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('restricts provider payment state to supported normalized states', () => {
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

    const insertPayment = db.prepare(
      'INSERT INTO provider_payments(id,order_id,provider_payment_id,state) VALUES(?,?,?,?)',
    );
    const validStates = [
      'approved',
      'pending',
      'rejected',
      'cancelled',
      'refunded',
      'partially_refunded',
      'charged_back',
    ];
    validStates.forEach((state, index) => {
      expect(() => insertPayment.run(`payment-${index}`, 'order', `provider-${index}`, state))
        .not.toThrow();
    });

    expect(() => insertPayment.run('payment-invalid-insert', 'order', 'provider-invalid-insert', 'unknown'))
      .toThrow(/invalid provider payment state/);
    expect(() => db.prepare('UPDATE provider_payments SET state=? WHERE id=?')
      .run('in_process', 'payment-0')).toThrow(/invalid provider payment state/);
    expect(db.prepare('SELECT state FROM provider_payments WHERE id=?').get('payment-0'))
      .toEqual({ state: 'approved' });
  } finally {
    db.close();
  }
});
