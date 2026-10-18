// Fake payment provider for local development and testing
import crypto from 'node:crypto';
import type {
  PaymentProvider,
  CheckoutResult,
  PaymentState,
  RefundResult,
  WebhookVerification,
} from './index.js';

export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  private payments = new Map<string, PaymentState>();
  private checkoutIdsByKey = new Map<string, string>();
  private refundsByKey = new Map<string, RefundResult>();

  async createCheckout(params: {
    orderId: string;
    courseTitle: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    backUrl: string;
  }): Promise<CheckoutResult> {
    const existingId = this.checkoutIdsByKey.get(params.idempotencyKey);
    if (existingId) {
      return {
        checkoutUrl: this.checkoutUrl(existingId, params.backUrl),
        providerOrderId: existingId,
      };
    }
    const id = crypto.randomUUID();
    const state: PaymentState = {
      providerPaymentId: id,
      status: 'pending',
      amountMinor: params.amountMinor,
      currency: params.currency,
      metadata: {
        orderId: params.orderId,
        external_reference: params.orderId,
        transactions: { payments: [{ id: crypto.randomUUID() }], refunds: [] },
      },
    };
    this.payments.set(id, state);
    this.checkoutIdsByKey.set(params.idempotencyKey, id);
    return {
      checkoutUrl: this.checkoutUrl(id, params.backUrl),
      providerOrderId: id,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentState> {
    const payment = this.payments.get(providerPaymentId);
    if (!payment) throw new Error(`Fake payment ${providerPaymentId} not found`);
    return payment;
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string>): WebhookVerification {
    return {
      valid: true,
      externalEventId: headers['x-event-id'] ?? crypto.randomUUID(),
      payloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
    };
  }

  async refund(params: {
    providerOrderId: string;
    transactionId?: string;
    amountMinor?: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const key = `${params.providerOrderId}:${params.idempotencyKey}`;
    const existing = this.refundsByKey.get(key);
    if (existing) return existing;
    const payment = this.payments.get(params.providerOrderId);
    const transactions = payment?.metadata.transactions as
      | { payments?: Array<{ id?: string }>; refunds?: Array<{ id: string; amount: string; status: string }> }
      | undefined;
    const refunds = transactions?.refunds ?? [];
    const refundedSoFar = refunds.reduce((total, refund) => total + Math.round(Number(refund.amount) * 100), 0);
    const amountMinor = params.amountMinor ?? Math.max(0, (payment?.amountMinor ?? 0) - refundedSoFar);
    const providerRef = crypto.randomUUID();
    const result: RefundResult = {
      providerRef,
      amountMinor,
      status: 'approved',
    };
    if (payment) {
      const nextRefunds = [...refunds, {
        id: providerRef,
        amount: (amountMinor / 100).toFixed(2),
        status: 'processed',
      }];
      payment.status = refundedSoFar + amountMinor >= payment.amountMinor ? 'refunded' : 'partially_refunded';
      payment.metadata = {
        ...payment.metadata,
        transactions: { ...transactions, refunds: nextRefunds },
      };
    }
    this.refundsByKey.set(key, result);
    return result;
  }

  /** Test helper: simulate a successful payment */
  simulateApproval(providerPaymentId: string): void {
    const p = this.payments.get(providerPaymentId);
    if (p) p.status = 'approved';
  }

  simulateCancellation(providerPaymentId: string): void {
    const p = this.payments.get(providerPaymentId);
    if (p) p.status = 'cancelled';
  }

  private checkoutUrl(providerOrderId: string, backUrl: string) {
    const url = new URL(`/dev/fake-checkout/${providerOrderId}`, backUrl);
    return url.toString();
  }
}
