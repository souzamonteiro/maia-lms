import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import type { PaymentProvider, RefundResult } from '@maia/providers';
import { runMigrations } from '../db/migrate.js';
import { requestOrderRefund } from './payment-refunds.js';

function setup() {
  const db = new Database(':memory:');
  runMigrations(db);
  db.exec(`
    INSERT INTO users(id,email,email_normalized,password_hash,locale) VALUES
      ('buyer','buyer@example.com','buyer@example.com','hash','en'),
      ('admin','admin@example.com','admin@example.com','hash','admin');
    INSERT INTO courses(id,slug,author_id,status,access_mode) VALUES('course','course','admin','DRAFT','PAID');
    INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,price_amount_minor,price_currency,duration_minutes,instructor_name)
      VALUES('revision','course','Paid course','Summary','course','PAID','en',1000,'BRL',60,'Admin');
    UPDATE courses SET current_revision_id='revision' WHERE id='course';
    UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
    UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
    INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,access_terms_snapshot,
      price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
      VALUES('order','buyer','course','revision','Paid course','One year',1000,'BRL','mercado_pago','order-key','PAID','provider-order');
    INSERT INTO enrollments(id,user_id,course_id,revision_id,completed_at)
      VALUES('enrollment','buyer','course','revision','2026-01-01 00:00:00');
    INSERT INTO entitlements(id,enrollment_id,source_type,source_id,starts_at)
      VALUES('entitlement','enrollment','order','order',datetime('now'));
    INSERT INTO certificates(id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,
      payload_json,disclosure_hash,disclosure_consented_at,disclosure_version)
      VALUES('certificate','enrollment','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Buyer Name','payload-hash','2026-01-02 00:00:00',
        '{"confirmedName":"Buyer Name","courseTitle":"Paid course","workloadMinutes":60,"issuerName":"Admin","completedAt":"2026-01-01 00:00:00","publicCode":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","issuedAt":"2026-01-02 00:00:00","status":"valid"}',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-01-02 00:00:00','v1');
    INSERT INTO provider_payments(id,order_id,provider_payment_id,state,raw_ref)
      VALUES('payment','order','provider-order','approved','{"paymentTransactionIds":["transaction"]}');
  `);
  return db;
}

it('keeps access for partial refunds and revokes it after the remaining balance is refunded', async () => {
  const db = setup();
  const calls: Array<{ providerOrderId: string; transactionId?: string; amountMinor?: number; idempotencyKey: string }> = [];
  const provider: PaymentProvider = {
    name: 'mercado_pago',
    createCheckout: async () => { throw new Error('Not used'); },
    getPayment: async () => { throw new Error('Not used'); },
    verifyWebhook: () => ({ valid: false, externalEventId: null, payloadHash: '' }),
    refund: async params => {
      calls.push(params);
      return { providerRef: `refund-${calls.length}`, amountMinor: params.amountMinor ?? 1000, status: 'approved' };
    },
  };
  const common = { orderId: 'order', actorId: 'admin', reason: 'Support approved refund.' };
  try {
    const partial = await requestOrderRefund(db, provider, {
      ...common,
      idempotencyKey: 'partial-key',
      amountMinor: 400,
    });
    expect(partial).toMatchObject({ status: 'approved', amountMinor: 400, orderState: 'PARTIALLY_REFUNDED' });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'PARTIALLY_REFUNDED' });
    expect(db.prepare('SELECT state FROM enrollments WHERE id=?').get('enrollment'))
      .toEqual({ state: 'active' });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE id=?').get('entitlement'))
      .toEqual({ revoked_at: null });
    expect(db.prepare('SELECT revoked_at,reason FROM certificates WHERE id=?').get('certificate'))
      .toEqual({ revoked_at: null, reason: null });

    await requestOrderRefund(db, provider, {
      ...common,
      idempotencyKey: 'partial-key',
      amountMinor: 400,
    });
    expect(calls).toHaveLength(1);

    const rest = await requestOrderRefund(db, provider, {
      ...common,
      idempotencyKey: 'remaining-key',
    });
    expect(rest).toMatchObject({ status: 'approved', amountMinor: 600, orderState: 'REFUNDED' });
    expect(calls[1]).toMatchObject({
      providerOrderId: 'provider-order',
      transactionId: 'transaction',
      amountMinor: 600,
    });
    expect(db.prepare('SELECT state FROM enrollments WHERE id=?').get('enrollment'))
      .toEqual({ state: 'revoked' });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE id=?').get('entitlement').revoked_at)
      .toBeTruthy();
    expect(db.prepare('SELECT revoked_at,reason FROM certificates WHERE id=?').get('certificate'))
      .toMatchObject({ reason: 'Payment fully refunded: Support approved refund.' });
    expect(db.prepare('SELECT count(*) AS total FROM audit_events WHERE action=?')
      .get('order.refund')).toEqual({ total: 2 });
  } finally {
    db.close();
  }
});

it('retries a provider timeout with the same refund idempotency key', async () => {
  const db = setup();
  const requestKeys: string[] = [];
  let attempts = 0;
  const provider: PaymentProvider = {
    name: 'mercado_pago',
    createCheckout: async () => { throw new Error('Not used'); },
    getPayment: async () => { throw new Error('Not used'); },
    verifyWebhook: () => ({ valid: false, externalEventId: null, payloadHash: '' }),
    refund: async params => {
      requestKeys.push(params.idempotencyKey);
      attempts++;
      if (attempts === 1) throw new Error('Temporary provider failure');
      return { providerRef: 'refund-on-retry', amountMinor: 1000, status: 'approved' };
    },
  };
  try {
    await expect(requestOrderRefund(db, provider, {
      orderId: 'order', actorId: 'admin', idempotencyKey: 'retry-key', reason: 'Retry same request.',
    })).rejects.toMatchObject({ code: 'ORDER_REFUND_PROVIDER_UNAVAILABLE' });
    expect(db.prepare('SELECT status FROM refunds WHERE idempotency_key=?').get('retry-key'))
      .toEqual({ status: 'pending' });
    expect(await requestOrderRefund(db, provider, {
      orderId: 'order', actorId: 'admin', idempotencyKey: 'retry-key', reason: 'Retry same request.',
    })).toMatchObject({ providerRef: 'refund-on-retry', status: 'approved' });
    expect(requestKeys).toEqual(['retry-key', 'retry-key']);
    expect(db.prepare('SELECT count(*) AS total FROM refunds WHERE order_id=?').get('order'))
      .toEqual({ total: 1 });
  } finally {
    db.close();
  }
});

it('reconciles a pending refund through the same key and preserves access after rejection', async () => {
  const db = setup();
  const requestKeys: string[] = [];
  const responses: RefundResult[] = [
    { providerRef: 'pending-refund', amountMinor: 400, status: 'pending' },
    { providerRef: 'approved-refund', amountMinor: 400, status: 'approved' },
    { providerRef: 'rejected-refund', amountMinor: 200, status: 'rejected' },
  ];
  const provider: PaymentProvider = {
    name: 'mercado_pago',
    createCheckout: async () => { throw new Error('Not used'); },
    getPayment: async () => { throw new Error('Not used'); },
    verifyWebhook: () => ({ valid: false, externalEventId: null, payloadHash: '' }),
    refund: async params => {
      requestKeys.push(params.idempotencyKey);
      return responses.shift()!;
    },
  };
  try {
    const pending = await requestOrderRefund(db, provider, {
      orderId: 'order', actorId: 'admin', idempotencyKey: 'stable-pending-key',
      amountMinor: 400, reason: 'Approved customer refund request.',
    });
    expect(pending).toMatchObject({ status: 'pending', amountMinor: 400 });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order')).toEqual({ state: 'PAID' });

    const reconciled = await requestOrderRefund(db, provider, {
      orderId: 'order', actorId: 'admin', idempotencyKey: 'stable-pending-key',
      amountMinor: 400, reason: 'Approved customer refund request.',
    });
    expect(reconciled).toMatchObject({ status: 'approved', orderState: 'PARTIALLY_REFUNDED' });
    await expect(requestOrderRefund(db, provider, {
      orderId: 'order', actorId: 'admin', idempotencyKey: 'stable-pending-key',
      amountMinor: 400, reason: 'Different request reason.',
    })).rejects.toMatchObject({ code: 'ORDER_REFUND_IDEMPOTENCY_CONFLICT' });

    const rejected = await requestOrderRefund(db, provider, {
      orderId: 'order', actorId: 'admin', idempotencyKey: 'rejected-key',
      amountMinor: 200, reason: 'Provider rejected this amount.',
    });
    expect(rejected).toMatchObject({ status: 'rejected', amountMinor: 200 });
    expect(requestKeys).toEqual(['stable-pending-key', 'stable-pending-key', 'rejected-key']);
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('order'))
      .toEqual({ state: 'PARTIALLY_REFUNDED' });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE id=?').get('entitlement'))
      .toEqual({ revoked_at: null });
    expect(db.prepare('SELECT revoked_at FROM certificates WHERE id=?').get('certificate'))
      .toEqual({ revoked_at: null });
    expect(db.prepare("SELECT metadata FROM audit_events WHERE action='order.refund' ORDER BY occurred_at")
      .all().map(row => JSON.parse(row.metadata).status)).toEqual(['pending', 'approved', 'rejected']);
  } finally {
    db.close();
  }
});