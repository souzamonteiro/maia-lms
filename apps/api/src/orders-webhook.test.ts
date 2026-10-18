import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import type { PaymentProvider, PaymentState } from '@maia/providers';
import { MercadoPagoProvider } from '@maia/providers';
import argon2 from 'argon2';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { loadConfig } from './config.js';

it('verifies and deduplicates authoritative order webhooks before granting access', async () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  db.exec(`
    INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('buyer','buyer@example.com','buyer@example.com','hash');
    UPDATE users SET role='admin' WHERE id='buyer';
    INSERT INTO courses(id,slug,author_id,status,access_mode)
      VALUES('course','paid-course','buyer','DRAFT','PAID');
    INSERT INTO course_revisions(id,course_id,title,summary,slug,access_mode,locale,
      price_amount_minor,price_currency,access_terms,duration_minutes,instructor_name)
      VALUES('revision','course','Paid course','Summary','paid-course','PAID','en',2599,'BRL','One year',60,'Admin');
    UPDATE courses SET current_revision_id='revision' WHERE id='course';
    UPDATE course_revisions SET published_at=datetime('now') WHERE id='revision';
    UPDATE courses SET status='PUBLISHED',published_revision_id='revision' WHERE id='course';
    INSERT INTO orders(id,user_id,course_id,course_revision_id,course_title_snapshot,
      access_terms_snapshot,price_snapshot,currency,provider,idempotency_key,state,provider_checkout_id)
      VALUES('local-order','buyer','course','revision','Paid course','One year',2599,'BRL',
        'mercado_pago','buyer-key','CHECKOUT_PENDING','remote-order');
  `);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?')
    .run(await argon2.hash('Refresh-buyer-password-123'), 'buyer');

  const adapter = new MercadoPagoProvider('test-token', 'webhook-secret');
  let state: PaymentState = {
    providerPaymentId: 'remote-order',
    status: 'pending',
    amountMinor: 2599,
    currency: 'BRL',
    metadata: {
      external_reference: 'local-order',
      user_id: 'seller-1',
      transactions: { payments: [{ id: 'remote-transaction' }] },
    },
  };
  const provider: PaymentProvider = {
    name: 'mercado_pago',
    createCheckout: async () => { throw new Error('Not used by webhook test'); },
    getPayment: async id => ({ ...state, providerPaymentId: id }),
    verifyWebhook: (rawBody, headers, dataId) => adapter.verifyWebhook(rawBody, headers, dataId),
    refund: async params => ({
      providerRef: 'refund-from-admin',
      amountMinor: params.amountMinor ?? 2599,
      status: 'approved',
    }),
  };
  const config = {
    ...loadConfig(),
    NODE_ENV: 'test' as const,
    PUBLIC_BASE_URL: 'http://learn.example',
    PAYMENT_PROVIDER: 'mercado_pago' as const,
    MP_ENVIRONMENT: 'sandbox' as const,
    MP_ACCESS_TOKEN: 'test-token',
    MP_WEBHOOK_SECRET: 'webhook-secret',
    MP_SELLER_ID: 'seller-1',
    PAYMENTS_CHECKOUT_ENABLED: false,
  };
  const server = createApp(db, config, provider).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', password: 'Refresh-buyer-password-123' }),
  });
  expect(login.status).toBe(200);
  const buyerCookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';

  const disabledCheckout = await fetch(`${base}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
    body: JSON.stringify({ courseId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }),
  });
  expect(disabledCheckout.status).toBe(503);
  expect(await disabledCheckout.json()).toMatchObject({ code: 'PAYMENT_CHECKOUT_NOT_READY' });

  async function sendWebhook(eventId: string, tamperSignature = false, action = 'order.updated') {
    const body = Buffer.from(JSON.stringify({
      id: eventId,
      type: 'order',
      action,
      api_version: 'v1',
      application_id: '123456789',
      date_created: '2026-10-13T20:00:00.000Z',
      live_mode: false,
      user_id: 123456,
      data: { id: 'remote-order' },
    }));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const requestId = `request-${eventId}`;
    const manifest = `id:remote-order;request-id:${requestId};ts:${timestamp};`;
    const signature = crypto.createHmac('sha256', 'webhook-secret').update(manifest).digest('hex');
    const response = await fetch(`${base}/api/v1/webhooks/mercado-pago?data.id=remote-order&type=order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://notifications.mercadopago.com',
        'X-Request-Id': requestId,
        'X-Signature': `ts=${timestamp},v1=${tamperSignature ? '0'.repeat(64) : signature}`,
      },
      body,
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    expect(await sendWebhook('event-pending')).toMatchObject({
      status: 200,
      body: { received: true, result: 'pending' },
    });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('local-order'))
      .toEqual({ state: 'CHECKOUT_PENDING' });
    expect(db.prepare('SELECT count(*) AS total FROM entitlements').get()).toEqual({ total: 0 });

    state = { ...state, status: 'approved', amountMinor: 2600 };
    expect((await sendWebhook('event-approved')).body.result).toBe('snapshot_mismatch');
    expect(db.prepare("SELECT status FROM webhook_events WHERE external_event_id='event-approved'").get())
      .toEqual({ status: 'failed' });
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('local-order'))
      .toEqual({ state: 'CHECKOUT_PENDING' });

    state = { ...state, amountMinor: 2599 };
    expect((await sendWebhook('event-approved')).body.result).toBe('paid');
    expect((await sendWebhook('event-approved')).body.duplicate).toBe(true);
    expect(db.prepare('SELECT state FROM orders WHERE id=?').get('local-order'))
      .toEqual({ state: 'PAID' });
    expect(db.prepare('SELECT count(*) AS total FROM enrollments WHERE course_id=?').get('course'))
      .toEqual({ total: 1 });
    expect(db.prepare("SELECT count(*) AS total FROM entitlements WHERE source_type='order'").get())
      .toEqual({ total: 1 });
    expect(db.prepare('SELECT state FROM provider_payments WHERE order_id=?').get('local-order'))
      .toEqual({ state: 'approved' });

    db.exec('DELETE FROM entitlements; DELETE FROM enrollments;');
    const refreshed = await fetch(`${base}/api/v1/me/orders/local-order/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
      body: '{}',
    });
    expect(refreshed.status).toBe(200);
    expect(await refreshed.json()).toMatchObject({ orderId: 'local-order', state: 'PAID' });
    expect(db.prepare("SELECT count(*) AS total FROM entitlements WHERE source_type='order'").get())
      .toEqual({ total: 1 });

    db.prepare("UPDATE enrollments SET completed_at='2026-01-01 00:00:00' WHERE user_id=? AND course_id=?")
      .run('buyer', 'course');
    db.exec(`INSERT INTO certificates(id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,
      payload_json,disclosure_hash,disclosure_consented_at,disclosure_version)
      SELECT 'certificate',id,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Buyer Name','certificate-hash','2026-01-02 00:00:00',
        '{"confirmedName":"Buyer Name","courseTitle":"Paid course","workloadMinutes":60,"issuerName":"Admin","completedAt":"2026-01-01 00:00:00","publicCode":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","issuedAt":"2026-01-02 00:00:00","status":"valid"}',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-01-02 00:00:00','v1'
      FROM enrollments WHERE user_id='buyer' AND course_id='course'`);
    const adminOrders = await fetch(`${base}/api/v1/admin/orders?q=buyer%40example.com`, {
      headers: { Cookie: buyerCookie },
    });
    expect(adminOrders.status).toBe(200);
    expect(await adminOrders.json()).toMatchObject({
      items: [{ id: 'local-order', state: 'PAID', receipt_status: 'queued' }],
      total: 1,
    });

    const partialRefund = await fetch(`${base}/api/v1/admin/orders/local-order/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        amountMinor: 500,
        reason: 'Approved partial customer refund.',
      }),
    });
    expect(partialRefund.status).toBe(200);
    expect(await partialRefund.json()).toMatchObject({ status: 'approved', orderState: 'PARTIALLY_REFUNDED' });
    expect(db.prepare('SELECT revoked_at FROM certificates WHERE id=?').get('certificate'))
      .toEqual({ revoked_at: null });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE source_id=?').get('local-order'))
      .toEqual({ revoked_at: null });

    const chargeback = await fetch(`${base}/api/v1/admin/orders/local-order/chargeback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
      body: JSON.stringify({ reason: 'Provider dispute confirmed by support.' }),
    });
    expect(chargeback.status).toBe(200);
    expect(await chargeback.json()).toMatchObject({ state: 'CHARGEBACK', changed: true });
    expect(db.prepare('SELECT state FROM provider_payments WHERE order_id=?').get('local-order'))
      .toEqual({ state: 'charged_back' });
    expect(db.prepare('SELECT revoked_at,reason FROM certificates WHERE id=?').get('certificate'))
      .toMatchObject({ reason: 'Payment chargeback: Provider dispute confirmed by support.' });
    expect(db.prepare('SELECT revoked_at FROM entitlements WHERE source_id=?').get('local-order').revoked_at)
      .toBeTruthy();
    state = {
      ...state,
      status: 'charged_back',
      metadata: {
        ...state.metadata,
        status_detail: 'settled',
        transactions: { chargebacks: [{ id: 'provider-chargeback', case_id: 'case-1', status: 'settled' }] },
      },
    };
    expect(await sendWebhook('event-chargeback', false, 'order.charged_back')).toMatchObject({
      status: 200,
      body: { received: true, result: 'charged_back' },
    });
    const orderHistory = await fetch(`${base}/api/v1/admin/orders/local-order/history`, {
      headers: { Cookie: buyerCookie },
    });
    expect(await orderHistory.json()).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ action: 'order.refund' }),
        expect.objectContaining({ action: 'order.chargeback' }),
        expect.objectContaining({ action: 'certificate.revoke' }),
      ]),
    });

    expect((await sendWebhook('tampered-event', true)).status).toBe(401);
    expect(db.prepare("SELECT count(*) AS total FROM webhook_events WHERE external_event_id='tampered-event'").get())
      .toEqual({ total: 0 });

    const changedBody = Buffer.from(JSON.stringify({
      id: 'event-approved',
      type: 'order',
      action: 'order.canceled',
      api_version: 'v1',
      application_id: '123456789',
      date_created: '2026-10-13T20:00:00.000Z',
      live_mode: false,
      user_id: 123456,
      data: { id: 'remote-order' },
    }));
    const changedTimestamp = String(Math.floor(Date.now() / 1000));
    const changedRequestId = 'request-event-approved';
    const changedManifest = `id:remote-order;request-id:${changedRequestId};ts:${changedTimestamp};`;
    const changedSignature = crypto.createHmac('sha256', 'webhook-secret').update(changedManifest).digest('hex');
    const conflict = await fetch(`${base}/api/v1/webhooks/mercado-pago?data.id=remote-order&type=order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://notifications.mercadopago.com',
        'X-Request-Id': changedRequestId,
        'X-Signature': `ts=${changedTimestamp},v1=${changedSignature}`,
      },
      body: changedBody,
    });
    expect(conflict.status).toBe(409);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()),
    );
    db.close();
  }
});