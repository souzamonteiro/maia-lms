// Payment provider port definition

export interface CheckoutResult {
  checkoutUrl: string;
  providerOrderId: string;
}

export interface PaymentState {
  providerPaymentId: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  amountMinor: number;
  currency: string;
  metadata: Record<string, unknown>;
}

export interface RefundResult {
  providerRef: string;
  amountMinor: number;
  status: 'approved' | 'pending' | 'rejected';
}

export interface WebhookVerification {
  valid: boolean;
  externalEventId: string | null;
  payloadHash: string;
}

export interface PaymentProvider {
  readonly name: string;

  createCheckout(params: {
    orderId: string;
    courseTitle: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    backUrl: string;
  }): Promise<CheckoutResult>;

  getPayment(providerPaymentId: string): Promise<PaymentState>;

  verifyWebhook(rawBody: Buffer, headers: Record<string, string>): WebhookVerification;

  refund(params: {
    providerPaymentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<RefundResult>;
}
