import crypto from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { MercadoPagoProvider } from './mercado-pago.js';

it('creates an idempotent Checkout Pro order and normalizes the authoritative order response', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(JSON.stringify({ id: 'order-provider-1', checkout_url: 'https://pay.example/checkout/1' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
    new Response(JSON.stringify({
      id: 'order-provider-1',
      status: 'processed',
      status_detail: 'accredited',
      total_amount: '25.99',
      total_paid_amount: '25.99',
      currency: 'BRL',
      external_reference: 'local-order-1',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ];
  const fetchMock = vi.fn(async () => responses.shift()!);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  try {
    const provider = new MercadoPagoProvider('test-access-token', 'test-webhook-secret');
    const checkout = await provider.createCheckout({
      orderId: 'local-order-1',
      courseTitle: 'Published course',
      amountMinor: 2599,
      currency: 'BRL',
      idempotencyKey: 'stable-key',
      backUrl: 'https://learn.example/my-orders?order=local-order-1',
    });
    expect(checkout).toEqual({
      checkoutUrl: 'https://pay.example/checkout/1',
      providerOrderId: 'order-provider-1',
    });
    const createRequest = fetchMock.mock.calls[0];
    expect(String(createRequest[0])).toBe('https://api.mercadopago.com/v1/orders');
    expect(createRequest[1]?.headers).toMatchObject({
      Authorization: 'Bearer test-access-token',
      'X-Idempotency-Key': 'stable-key',
    });
    expect(JSON.parse(String(createRequest[1]?.body))).toMatchObject({
      type: 'online',
      processing_mode: 'manual',
      capture_mode: 'automatic_async',
      total_amount: '25.99',
      external_reference: 'local-order-1',
      items: [{ title: 'Published course', quantity: 1, unit_price: '25.99', total_amount: '25.99' }],
    });

    expect(await provider.getPayment('order-provider-1')).toMatchObject({
      providerPaymentId: 'order-provider-1',
      status: 'approved',
      amountMinor: 2599,
      currency: 'BRL',
      metadata: { external_reference: 'local-order-1' },
    });
    expect(String(fetchMock.mock.calls[1][0]))
      .toBe('https://api.mercadopago.com/v1/orders/order-provider-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('verifies the documented data.id query manifest and rejects modified values', () => {
  const provider = new MercadoPagoProvider('test-access-token', 'secret-key');
  const rawBody = Buffer.from(JSON.stringify({ id: 'notification-123', type: 'order', data: { id: 'remote-order' } }));
  const dataId = 'remote-order';
  const requestId = 'request-123';
  const timestamp = '1791921600';
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac('sha256', 'secret-key').update(manifest).digest('hex');
  const headers = { 'x-signature': `ts=${timestamp},v1=${signature}`, 'x-request-id': requestId };

  expect(provider.verifyWebhook(rawBody, headers, dataId)).toMatchObject({
    valid: true,
    externalEventId: 'notification-123',
  });
  expect(provider.verifyWebhook(rawBody, headers, 'different-order').valid).toBe(false);
  expect(provider.verifyWebhook(rawBody, { ...headers, 'x-request-id': 'modified' }, dataId).valid)
    .toBe(false);
});

it('uses the Checkout Pro Orders refund endpoint and requires transaction details for partial refunds', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    id: 'provider-order',
    status: 'processed',
    transactions: { refunds: [{ id: 'provider-refund', amount: '10.00', status: 'processed' }] },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  try {
    const provider = new MercadoPagoProvider('test-access-token', 'test-webhook-secret');
    await expect(provider.refund({
      providerOrderId: 'provider-order',
      amountMinor: 1000,
      idempotencyKey: 'refund-key',
    })).rejects.toThrow(/transaction ID and amount/);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await provider.refund({
      providerOrderId: 'provider-order',
      transactionId: 'transaction-1',
      amountMinor: 1000,
      idempotencyKey: 'refund-key',
    })).toEqual({ providerRef: 'provider-refund', amountMinor: 1000, status: 'approved' });
    expect(String(fetchMock.mock.calls[0][0]))
      .toBe('https://api.mercadopago.com/v1/orders/provider-order/refund');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ 'X-Idempotency-Key': 'refund-key' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      transactions: [{ id: 'transaction-1', amount: '10.00' }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});