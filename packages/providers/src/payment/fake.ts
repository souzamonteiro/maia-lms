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

  async createCheckout(params: {
    orderId: string;
    courseTitle: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    backUrl: string;
  }): Promise<CheckoutResult> {
    const id = crypto.randomUUID();
    const state: PaymentState = {
      providerPaymentId: id,
      status: 'pending',
      amountMinor: params.amountMinor,
      currency: params.currency,
      metadata: { orderId: params.orderId },
    };
    this.payments.set(id, state);
    return {
      checkoutUrl: `http://localhost:3000/dev/fake-checkout?paymentId=${id}&backUrl=${encodeURIComponent(params.backUrl)}`,
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
    providerPaymentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const payment = this.payments.get(params.providerPaymentId);
    if (payment) payment.status = 'refunded';
    return {
      providerRef: crypto.randomUUID(),
      amountMinor: params.amountMinor,
      status: 'approved',
    };
  }

  /** Test helper: simulate a successful payment */
  simulateApproval(providerPaymentId: string): void {
    const p = this.payments.get(providerPaymentId);
    if (p) p.status = 'approved';
  }
}
