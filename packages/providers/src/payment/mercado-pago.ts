// Mercado Pago Checkout Pro adapter
import crypto from 'node:crypto';
import type {
  PaymentProvider,
  CheckoutResult,
  PaymentState,
  RefundResult,
  WebhookVerification,
} from './index.js';

const MP_API_BASE = 'https://api.mercadopago.com';

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercado_pago';

  constructor(
    private readonly accessToken: string,
    private readonly webhookSecret: string,
  ) {}

  async createCheckout(params: {
    orderId: string;
    courseTitle: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    backUrl: string;
  }): Promise<CheckoutResult> {
    const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'X-Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        items: [
          {
            id: params.orderId,
            title: params.courseTitle,
            quantity: 1,
            unit_price: params.amountMinor / 100,
            currency_id: params.currency,
          },
        ],
        back_urls: {
          success: params.backUrl,
          failure: params.backUrl,
          pending: params.backUrl,
        },
        auto_return: 'approved',
        external_reference: params.orderId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MercadoPago createCheckout failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { id: string; init_point: string };
    return {
      checkoutUrl: data.init_point,
      providerOrderId: data.id,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentState> {
    const response = await fetch(`${MP_API_BASE}/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`MercadoPago getPayment failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      transaction_amount: number;
      currency_id: string;
    };

    return {
      providerPaymentId: String(data.id),
      status: this.normalizeStatus(data.status),
      amountMinor: Math.round(data.transaction_amount * 100),
      currency: data.currency_id,
      metadata: data as Record<string, unknown>,
    };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string>): WebhookVerification {
    // MP signature verification: x-signature header contains ts= and v1=
    const signature = headers['x-signature'] ?? '';
    const requestId = headers['x-request-id'] ?? '';
    const dataId = this.extractQueryParam(rawBody.toString(), 'data.id') ?? '';

    const tsMatch = signature.match(/ts=(\d+)/);
    const v1Match = signature.match(/v1=([a-f0-9]+)/);

    if (!tsMatch || !v1Match) {
      return { valid: false, externalEventId: null, payloadHash: '' };
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${tsMatch[1]};`;
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(v1Match[1], 'hex');
    const valid =
      expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    return {
      valid,
      externalEventId: dataId || null,
      payloadHash,
    };
  }

  async refund(params: {
    providerPaymentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const response = await fetch(`${MP_API_BASE}/v1/payments/${params.providerPaymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'X-Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({ amount: params.amountMinor / 100 }),
    });

    if (!response.ok) {
      throw new Error(`MercadoPago refund failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      amount: number;
      status: string;
    };
    return {
      providerRef: String(data.id),
      amountMinor: Math.round(data.amount * 100),
      status:
        data.status === 'approved'
          ? 'approved'
          : data.status === 'pending'
            ? 'pending'
            : 'rejected',
    };
  }

  private normalizeStatus(status: string): PaymentState['status'] {
    const map: Record<string, PaymentState['status']> = {
      approved: 'approved',
      pending: 'pending',
      in_process: 'pending',
      authorized: 'pending',
      rejected: 'rejected',
      cancelled: 'cancelled',
      refunded: 'refunded',
      charged_back: 'charged_back',
    };
    return map[status] ?? 'rejected';
  }

  private extractQueryParam(body: string, key: string): string | null {
    try {
      const params = new URLSearchParams(body);
      return params.get(key);
    } catch {
      return null;
    }
  }
}
