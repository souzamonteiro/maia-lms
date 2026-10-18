import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { applyProviderPayment } from './payment-settlement.js';

it('matches the immutable provider order snapshot and grants an entitlement exactly once', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
        VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id,status,access_mode)
        VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      UPDATE courses SET current_revision_id='revision' WHERE id='course';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
      INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,access_terms_snapshot,
        price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
        VALUES('order','buyer','course','revision','Paid course','One-year access',2599,'BRL',
          'mercado_pago','buyer-key','CHECKOUT_PENDING','provider-order');
    `);
    const payment = {
      providerPaymentId: 'provider-order',
      status: 'approved' as const,
      amountMinor: 2599,
      currency: 'BRL',
      metadata: { external_reference: 'order' },
    };
    const first = applyProviderPayment(db, 'mercado_pago', payment);
    const repeated = applyProviderPayment(db, 'mercado_pago', payment);
    expect(first).toMatchObject({ kind: 'paid', orderId: 'order' });
    expect(repeated).toEqual(first);
    expect(db.prepare('SELECT count(*) AS total FROM enrollments WHERE user_id=? AND course_id=?')
      .get('buyer', 'course')).toEqual({ total: 1 });
    expect(db.prepare("SELECT count(*) AS total FROM entitlements WHERE source_type='order' AND source_id=?")
      .get('order')).toEqual({ total: 1 });
    expect(db.prepare('SELECT count(*) AS total FROM provider_payments WHERE order_id=?')
      .get('order')).toEqual({ total: 1 });
    expect(db.prepare("SELECT payload FROM outbox WHERE event_type='email.send'").get())
      .toMatchObject({ payload: expect.stringContaining('Pagamento confirmado') });

    db.exec('DELETE FROM entitlements; DELETE FROM enrollments;');
    expect(applyProviderPayment(db, 'mercado_pago', payment).kind).toBe('paid');
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

it('does not grant access when provider amount, currency or external reference differs', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash) VALUES('buyer','b@e.test','b@e.test','hash');
      INSERT INTO courses(id,slug,author_id,status,access_mode) VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      UPDATE courses SET current_revision_id='revision' WHERE id='course';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
      INSERT INTO orders(id,user_id,course_id,course_revision_id,price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
        VALUES('order','buyer','course','revision',2599,'BRL','mercado_pago','key','CHECKOUT_PENDING','provider-order');
    `);
    expect(applyProviderPayment(db, 'mercado_pago', {
      providerPaymentId: 'provider-order',
      status: 'approved',
      amountMinor: 2600,
      currency: 'BRL',
      metadata: { external_reference: 'order' },
    })).toEqual({ kind: 'snapshot_mismatch' });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'CHECKOUT_PENDING' });
    expect(db.prepare('SELECT count(*) AS total FROM entitlements').get()).toEqual({ total: 0 });
  } finally {
    db.close();
  }
});

it('does not grant access when authoritative provider seller differs from configured seller', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash) VALUES('buyer','b@e.test','b@e.test','hash');
      INSERT INTO courses(id,slug,author_id,status,access_mode) VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      UPDATE courses SET current_revision_id='revision' WHERE id='course';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
      INSERT INTO orders(id,user_id,course_id,course_revision_id,price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
        VALUES('order','buyer','course','revision',2599,'BRL','mercado_pago','key','CHECKOUT_PENDING','provider-order');
    `);
    expect(applyProviderPayment(db, 'mercado_pago', {
      providerPaymentId: 'provider-order',
      status: 'approved',
      amountMinor: 2599,
      currency: 'BRL',
      metadata: { external_reference: 'order', user_id: 'unexpected-seller' },
    }, 'configured-seller')).toEqual({ kind: 'snapshot_mismatch' });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'CHECKOUT_PENDING' });
    expect(db.prepare('SELECT count(*) AS total FROM entitlements').get()).toEqual({ total: 0 });
  } finally {
    db.close();
  }
});

it('revokes order access on an authoritative chargeback and ignores stale approval states', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash) VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id,status,access_mode) VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      UPDATE courses SET current_revision_id='revision' WHERE id='course';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
      INSERT INTO orders(id,user_id,course_id,course_revision_id,price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
        VALUES('order','buyer','course','revision',2599,'BRL','mercado_pago','key','CHECKOUT_PENDING','provider-order');
    `);
    const approved = {
      providerPaymentId: 'provider-order',
      status: 'approved' as const,
      amountMinor: 2599,
      currency: 'BRL',
      metadata: { external_reference: 'order' },
    };
    expect(applyProviderPayment(db, 'mercado_pago', approved).kind).toBe('paid');
    const chargeback = {
      ...approved,
      status: 'charged_back' as const,
      metadata: {
        external_reference: 'order',
        status_detail: 'settled',
        transactions: { chargebacks: [{ id: 'chargeback-1', case_id: 'case-1', status: 'settled' }] },
      },
    };
    expect(applyProviderPayment(db, 'mercado_pago', chargeback)).toEqual({ kind: 'charged_back', orderId: 'order' });
    expect(applyProviderPayment(db, 'mercado_pago', chargeback)).toEqual({ kind: 'charged_back', orderId: 'order' });
    expect(applyProviderPayment(db, 'mercado_pago', approved)).toEqual({ kind: 'snapshot_mismatch' });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order')).toEqual({ state: 'CHARGEBACK' });
    expect(db.prepare('SELECT state FROM provider_payments WHERE order_id=?').get('order'))
      .toEqual({ state: 'charged_back' });
    expect(db.prepare('SELECT state FROM enrollments WHERE course_id=?').get('course'))
      .toEqual({ state: 'revoked' });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE source_id=?').get('order').revoked_at)
      .toBeTruthy();
    expect(db.prepare("SELECT count(*) AS total FROM audit_events WHERE action='order.chargeback'").get())
      .toEqual({ total: 1 });
  } finally {
    db.close();
  }
});

it('reconciles provider refund records while preserving partial access and revoking full refunds', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash) VALUES('buyer','buyer@example.com','buyer@example.com','hash');
      INSERT INTO courses(id,slug,author_id,status,access_mode) VALUES('course','course','buyer','DRAFT','PAID');
      INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency)
        VALUES('revision','course','Paid course','Summary','course','PAID','en',2599,'BRL');
      UPDATE courses SET current_revision_id='revision' WHERE id='course';
      UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
      UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
      INSERT INTO orders(id,user_id,course_id,course_revision_id,price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
        VALUES('order','buyer','course','revision',2599,'BRL','mercado_pago','key','CHECKOUT_PENDING','provider-order');
    `);
    const approved = {
      providerPaymentId: 'provider-order',
      status: 'approved' as const,
      amountMinor: 2599,
      currency: 'BRL',
      metadata: { external_reference: 'order' },
    };
    expect(applyProviderPayment(db, 'mercado_pago', approved).kind).toBe('paid');
    db.prepare(`INSERT INTO refunds(id,order_id,provider_ref,amount_minor,status)
      VALUES('local-reservation','order','pending:local-reservation',500,'pending')`).run();
    const partial = {
      ...approved,
      status: 'partially_refunded' as const,
      metadata: {
        external_reference: 'order',
        transactions: { refunds: [{ id: 'partial-1', amount: '5.00', status: 'processed' }] },
      },
    };
    expect(applyProviderPayment(db, 'mercado_pago', partial).kind).toBe('partially_refunded');
    expect(applyProviderPayment(db, 'mercado_pago', partial).kind).toBe('partially_refunded');
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'PARTIALLY_REFUNDED' });
    expect(db.prepare('SELECT amount_minor,status FROM refunds WHERE provider_ref=?').get('partial-1'))
      .toEqual({ amount_minor: 500, status: 'approved' });
    expect(db.prepare('SELECT id FROM refunds WHERE provider_ref=?').get('partial-1'))
      .toEqual({ id: 'local-reservation' });
    expect(db.prepare('SELECT count(*) AS total FROM refunds WHERE order_id=?').get('order'))
      .toEqual({ total: 1 });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE source_id=?').get('order'))
      .toEqual({ revoked_at: null });

    const full = {
      ...approved,
      status: 'refunded' as const,
      metadata: {
        external_reference: 'order',
        transactions: {
          refunds: [
            { id: 'partial-1', amount: '5.00', status: 'processed' },
            { id: 'final-1', amount: '20.99', status: 'processed' },
          ],
        },
      },
    };
    expect(applyProviderPayment(db, 'mercado_pago', full).kind).toBe('refunded');
    expect(applyProviderPayment(db, 'mercado_pago', full).kind).toBe('refunded');
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'REFUNDED' });
    expect(db.prepare('SELECT sum(amount_minor) AS amount FROM refunds WHERE order_id=? AND status=?')
      .get('order', 'approved')).toEqual({ amount: 2599 });
    expect(db.prepare('SELECT state FROM enrollments WHERE course_id=?').get('course'))
      .toEqual({ state: 'revoked' });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE source_id=?').get('order').revoked_at)
      .toBeTruthy();
    expect(db.prepare("SELECT count(*) AS total FROM audit_events WHERE action='order.refund'").get())
      .toEqual({ total: 4 });
  } finally {
    db.close();
  }
});