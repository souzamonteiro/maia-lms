import Database from 'better-sqlite3';
import { expect, it, vi } from 'vitest';
import type { PaymentProvider, PaymentState } from '@maia/providers';
import { runMigrations } from '../db/migrate.js';
import { reconcilePendingPayments } from './payment-reconciliation.js';

it('reconciles aged pending orders and recovers paid orders missing access exactly once', async () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash,locale)
        VALUES('buyer','buyer@example.com','buyer@example.com','hash','en');
      INSERT INTO courses(id,slug,author_id,status,access_mode)
        VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      UPDATE courses SET current_revision_id='revision' WHERE id='course';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
      INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,access_terms_snapshot,
        price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id,updated_at)
        VALUES('order','buyer','course','revision','Paid course','One year',2599,'BRL',
          'mercado_pago','buyer-key','CHECKOUT_PENDING','provider-order',datetime('now','-10 minutes'));
    `);
    let payment: PaymentState = {
      providerPaymentId: 'provider-order',
      status: 'pending',
      amountMinor: 2599,
      currency: 'BRL',
      metadata: { external_reference: 'order', user_id: 'seller-1' },
    };
    const provider: PaymentProvider = {
      name: 'mercado_pago',
      createCheckout: async () => { throw new Error('Not used'); },
      getPayment: async () => payment,
      verifyWebhook: () => ({ valid: false, externalEventId: null, payloadHash: '' }),
      refund: async () => { throw new Error('Not used'); },
    };
    const now = new Date();

    expect(await reconcilePendingPayments(db, provider, 'seller-1', now)).toEqual({
      checked: 1,
      settled: 1,
      failed: 0,
    });

    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'CHECKOUT_PENDING' });

    payment = { ...payment, status: 'approved' };
    db.prepare("UPDATE orders SET updated_at=datetime('now','-10 minutes') WHERE id=?").run('order');
    expect(await reconcilePendingPayments(db, provider, 'seller-1', now)).toEqual({
      checked: 1,
      settled: 1,
      failed: 0,
    });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'PAID' });
    expect(db.prepare("SELECT count(*) AS total FROM outbox WHERE event_type='email.send'").get())
      .toEqual({ total: 1 });

    db.exec('DELETE FROM entitlements; DELETE FROM enrollments;');
  db.prepare("UPDATE orders SET updated_at=datetime('now','-10 minutes') WHERE id=?").run('order');
    expect(await reconcilePendingPayments(db, provider, 'seller-1', now)).toEqual({
      checked: 1,
      settled: 1,
      failed: 0,
    });
    expect(db.prepare('SELECT count(*) AS total FROM enrollments WHERE course_id=?').get('course'))
      .toEqual({ total: 1 });
    expect(db.prepare("SELECT count(*) AS total FROM entitlements WHERE source_type='order'").get())
      .toEqual({ total: 1 });
    expect(db.prepare("SELECT count(*) AS total FROM outbox WHERE event_type='email.send'").get())
      .toEqual({ total: 1 });
  } finally {
    db.close();
  }
});

it('records provider reconciliation outcomes without exposing payment identifiers or payloads', async () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash) VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id,status,access_mode) VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,access_terms_snapshot,
        price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id,updated_at)
        VALUES('order','buyer','course','revision','Paid course','One year',2599,'BRL',
          'mercado_pago','buyer-key','CHECKOUT_PENDING','private-provider-checkout',datetime('now','-10 minutes'));
    `);
    let behavior: 'throw' | 'mismatch' | 'pending' = 'throw';
    const provider: PaymentProvider = {
      name: 'mercado_pago',
      createCheckout: async () => { throw new Error('Not used'); },
      getPayment: async () => {
        if (behavior === 'throw') throw new Error('Sensitive provider token and response');
        return {
          providerPaymentId: 'private-provider-checkout',
          status: 'pending',
          amountMinor: 2599,
          currency: 'BRL',
          metadata: behavior === 'mismatch'
            ? { external_reference: 'different-order', user_id: 'seller' }
            : { external_reference: 'order', user_id: 'seller' },
        };
      },
      verifyWebhook: () => ({ valid: false, externalEventId: null, payloadHash: '' }),
      refund: async () => { throw new Error('Not used'); },
    };
    const run = () => reconcilePendingPayments(db, provider, 'seller');
    expect(await run()).toMatchObject({ checked: 1, settled: 0, failed: 1 });
    expect(db.prepare('SELECT outcome,check_count,duration_total_ms FROM payment_reconciliation_metrics_daily').all())
      .toEqual([expect.objectContaining({ outcome: 'failed', check_count: 1 })]);
    behavior = 'mismatch';
    db.prepare("UPDATE orders SET updated_at=datetime('now','-10 minutes') WHERE id='order'").run();
    expect(await run()).toMatchObject({ checked: 1, settled: 0, failed: 1 });
    behavior = 'pending';
    db.prepare("UPDATE orders SET updated_at=datetime('now','-10 minutes') WHERE id='order'").run();
    expect(await run()).toMatchObject({ checked: 1, settled: 1, failed: 0 });
    expect(db.prepare('SELECT outcome,check_count,duration_total_ms FROM payment_reconciliation_metrics_daily ORDER BY outcome').all())
      .toEqual([
        expect.objectContaining({ outcome: 'failed', check_count: 2 }),
        expect.objectContaining({ outcome: 'reconciled', check_count: 1 }),
      ]);
    const serialized = JSON.stringify(db.prepare('SELECT * FROM payment_reconciliation_metrics_daily').all());
    expect(serialized).not.toMatch(/buyer@example|private-provider|token|different-order/);
    expect(() => db.prepare('INSERT INTO payment_reconciliation_metrics_daily VALUES(?,?,?,?)')
      .run('2026-02-30', 'failed', 1, 0)).toThrow();
    expect(() => db.prepare('INSERT INTO payment_reconciliation_metrics_daily VALUES(?,?,?,?)')
      .run('2026-01-01', 'unknown', 1, 0)).toThrow();
    expect(() => db.prepare('INSERT INTO payment_reconciliation_metrics_daily VALUES(?,?,?,?)')
      .run('2026-01-01', 'failed', 1, -1)).toThrow();
    db.exec(`CREATE TRIGGER reject_payment_metrics BEFORE INSERT ON payment_reconciliation_metrics_daily
      BEGIN SELECT RAISE(ABORT,'Sensitive database error'); END;`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      db.prepare("UPDATE orders SET updated_at=datetime('now','-10 minutes') WHERE id='order'").run();
      expect(await run()).toMatchObject({ checked: 1, settled: 1, failed: 0 });
      expect(log).toHaveBeenCalledExactlyOnceWith('Payment reconciliation metrics write failed');
    } finally {
      log.mockRestore();
    }
  } finally {
    db.close();
  }
});