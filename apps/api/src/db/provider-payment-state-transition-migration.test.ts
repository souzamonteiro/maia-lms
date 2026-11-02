import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

it('allows provider settlement, late approvals, and reversals without stale state regressions', () => {
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
      INSERT INTO provider_payments(id,order_id,provider_payment_id,state)
        VALUES('pending-payment','order','pending-payment','pending'),
              ('pending-rejection','order','pending-rejection','pending'),
              ('pending-cancellation','order','pending-cancellation','pending'),
              ('rejected-payment','order','rejected-payment','rejected'),
              ('cancelled-payment','order','cancelled-payment','cancelled'),
              ('approved-payment','order','approved-payment','approved'),
              ('partial-payment','order','partial-payment','partially_refunded'),
              ('refunded-payment','order','refunded-payment','refunded'),
              ('charged-back-payment','order','charged-back-payment','charged_back');
    `);

    const updateState = db.prepare('UPDATE provider_payments SET state=? WHERE id=?');
    expect(() => updateState.run('approved', 'pending-payment')).not.toThrow();
    expect(() => updateState.run('rejected', 'pending-rejection')).not.toThrow();
    expect(() => updateState.run('cancelled', 'pending-cancellation')).not.toThrow();
    expect(() => updateState.run('approved', 'rejected-payment')).not.toThrow();
    expect(() => updateState.run('approved', 'cancelled-payment')).not.toThrow();
    expect(() => updateState.run('partially_refunded', 'approved-payment')).not.toThrow();
    expect(() => updateState.run('refunded', 'partial-payment')).not.toThrow();
    expect(() => updateState.run('charged_back', 'refunded-payment')).not.toThrow();

    expect(() => updateState.run('pending', 'approved-payment'))
      .toThrow(/invalid provider payment state transition/);
    expect(() => updateState.run('rejected', 'approved-payment'))
      .toThrow(/invalid provider payment state transition/);
    expect(() => updateState.run('approved', 'refunded-payment'))
      .toThrow(/invalid provider payment state transition/);
    expect(() => updateState.run('approved', 'charged-back-payment'))
      .toThrow(/invalid provider payment state transition/);
    expect(db.prepare('SELECT state FROM provider_payments WHERE id=?').get('charged-back-payment'))
      .toEqual({ state: 'charged_back' });
  } finally {
    db.close();
  }
});
