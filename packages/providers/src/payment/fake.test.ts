import { expect, it } from 'vitest';
import { FakePaymentProvider } from './fake.js';

it('tracks partial and full refunds cumulatively and reuses refund idempotency results', async () => {
  const provider = new FakePaymentProvider();
  const checkout = await provider.createCheckout({
    orderId: 'order-1',
    courseTitle: 'Test course',
    amountMinor: 1000,
    currency: 'BRL',
    idempotencyKey: 'checkout-key',
    backUrl: 'http://localhost:4320',
  });
  provider.simulateApproval(checkout.providerOrderId);
  const paid = await provider.getPayment(checkout.providerOrderId);
  const transactions = paid.metadata.transactions as { payments: Array<{ id: string }> };

  const partialParams = {
    providerOrderId: checkout.providerOrderId,
    transactionId: transactions.payments[0].id,
    amountMinor: 400,
    idempotencyKey: 'partial-key',
  };
  const partial = await provider.refund(partialParams);
  expect(await provider.refund(partialParams)).toEqual(partial);
  const partiallyRefunded = await provider.getPayment(checkout.providerOrderId);
  expect(partiallyRefunded.status).toBe('partially_refunded');
  expect((partiallyRefunded.metadata.transactions as { refunds: Array<{ amount: string }> }).refunds)
    .toMatchObject([{ amount: '4.00' }]);

  const full = await provider.refund({
    providerOrderId: checkout.providerOrderId,
    transactionId: transactions.payments[0].id,
    amountMinor: 600,
    idempotencyKey: 'remaining-key',
  });
  expect(full.amountMinor).toBe(600);
  expect((await provider.getPayment(checkout.providerOrderId)).status).toBe('refunded');
});